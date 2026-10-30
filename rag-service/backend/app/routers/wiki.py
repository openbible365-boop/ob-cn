import json
import logging
import uuid
import re
import traceback
from datetime import datetime
from typing import Any

import httpx
import sqlalchemy as sa
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status, Request
from sqlalchemy import select, delete

from app.config import settings
from app.db import SessionLocal
from app.deps import CurrentUser, SessionDep, require_role
from app.models import UserRole, WikiPage, WikiJob
from app.schemas import (
    WikiPageCreate,
    WikiPageUpdate,
    WikiPageRead,
    WikiJobRead,
)

router = APIRouter(
    prefix="/wiki",
    tags=["wiki"]
)

logger = logging.getLogger(__name__)


# ==================== LLM 交互辅助函数 ====================

async def call_llm(messages: list[dict[str, str]]) -> str:
    """
    异步非流式调用大模型 API。
    """
    api_url = f"{settings.openai_api_base.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
    }
    if settings.openai_api_key:
        headers["Authorization"] = f"Bearer {settings.openai_api_key}"

    payload = {
        "model": settings.llm_default_model,
        "messages": messages,
        "temperature": 0.3,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    async with httpx.AsyncClient(timeout=120.0, trust_env=False) as client:
        response = await client.post(api_url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error(f"LLM API returned status {response.status_code}: {response.text}")
            raise RuntimeError(f"LLM API returned status {response.status_code}")
        
        res_json = response.json()
        content = res_json.get("choices", [{}])[0].get("message", {}).get("content", "")
        return content.strip()


def clean_markdown_block(text: str) -> str:
    """
    清理大模型输出中可能带有的 ```markdown 或 ``` 包裹标记。
    """
    cleaned = text.strip()
    cleaned = re.sub(r"^```markdown\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"```\s*$", "", cleaned)
    return cleaned.strip()


def extract_plain_summary(markdown_content: str, max_len: int = 150) -> str:
    """
    从 Markdown 内容中提取纯文本段落作为简短摘要（自动跳过标题行）。
    """
    # 先按行过滤掉以 # 开头的标题行
    lines = [line.strip() for line in markdown_content.split("\n")]
    filtered_lines = [line for line in lines if not line.startswith("#")]
    
    plain_content = "\n".join(filtered_lines)
    
    # 移除粗体、斜体、双向链接括号等
    plain = re.sub(r"\[\[(.*?)\]\]", r"\1", plain_content)  # 把 [[A]] 替换为 A
    plain = re.sub(r"\*\*|__|\*|_", "", plain)      # 移除加粗斜体
    
    # 移除空行，取第一段
    paragraphs = [p.strip() for p in plain.split("\n") if p.strip()]
    if not paragraphs:
        return ""
    
    first_p = paragraphs[0]
    if len(first_p) > max_len:
        return first_p[:max_len] + "..."
    return first_p


# ==================== 后台异步任务 ====================

async def integrate_document_to_wiki_task(job_id: uuid.UUID, doc_id: uuid.UUID, extracted_text: str, user_id: uuid.UUID) -> None:
    """
    后台异步任务：读取文档内容，调用 LLM 提取实体，并增量融合/更新 Wiki 页面。
    """
    logger.info(f"Wiki integration job {job_id} started for doc {doc_id}")
    
    # 1. 更新 Job 状态为 processing
    async with SessionLocal() as db:
        job = await db.get(WikiJob, job_id)
        if not job:
            logger.error(f"WikiJob {job_id} not found")
            return
        job.status = "processing"
        await db.commit()

    try:
        # 限制输入大模型的文本长度，防止超出上下文限制 (限制在 6000 字符内，中文约 4000 个 Tokens)
        truncated_text = extracted_text[:6000]

        # 2. 提取实体
        logger.info(f"Job {job_id}: Extracting entities from doc...")
        entity_prompt = (
            "你是一个专业的知识工程专家。请阅读以下文本，并提取出核心的、有长久检索和归档价值的概念、人物、宗教术语、事件或主题列表（最多提取 6 个）。\n"
            "我们想为每一个提取出的概念在 Wiki 知识库中建立百科词条。\n"
            "注意：\n"
            "1. 概念名称应简明、规范，使用名词或专有名词（如“耶路撒冷”、“因信称义”等），不要提取长句子或宽泛的动词。\n"
            "2. 直接输出一个 JSON 格式的字符串数组，例如：[\"概念A\", \"概念B\", \"概念C\"]。不要有任何前导说明、Markdown 标记或后置解释。\n\n"
            f"需要分析的文本：\n{truncated_text}"
        )
        
        entities_content = await call_llm([{"role": "user", "content": entity_prompt}])
        logger.info(f"Job {job_id}: Raw entities extracted: {entities_content}")

        # 解析 JSON 实体列表
        entities = []
        try:
            # 兼容带有 Markdown ```json 包裹的输出
            clean_json = re.sub(r"^```json\s*", "", entities_content.strip(), flags=re.IGNORECASE)
            clean_json = re.sub(r"```$", "", clean_json)
            entities = json.loads(clean_json.strip())
        except Exception:
            # 备用方案：通过正则提取引号内的词条
            entities = re.findall(r'"([^"\n]+)"', entities_content)
            if not entities:
                entities = re.findall(r"'([^'\n]+)'", entities_content)

        # 过滤并清洗提取出的实体名称
        entities = [e.strip() for e in entities if e.strip() and len(e.strip()) < 50]
        if not entities:
            raise ValueError(f"Failed to extract any valid entity list from LLM output: {entities_content}")

        logger.info(f"Job {job_id}: Extracted entities: {entities}")

        # 3. 对每个实体，执行增量融合或新建
        for entity in entities:
            logger.info(f"Job {job_id}: Integrating entity '{entity}'...")
            
            # 从文档中提取提到该实体的片段（截取前后各 400 字，最多抓取前 3 个片段，辅助 LLM 更精准地获取上下文）
            context_blocks = []
            match_count = 0
            for match in re.finditer(re.escape(entity), truncated_text, re.IGNORECASE):
                if match_count >= 3:
                    break
                start = max(0, match.start() - 400)
                end = min(len(truncated_text), match.end() + 400)
                context_blocks.append(truncated_text[start:end])
                match_count += 1
            
            entity_context = "\n\n=== 相关片段 ===\n\n".join(context_blocks) if context_blocks else truncated_text[:3000]
            entity_context = entity_context[:3000]  # 二次确保上限

            async with SessionLocal() as db:
                stmt = select(WikiPage).where(WikiPage.title == entity)
                result = await db.execute(stmt)
                existing_page = result.scalars().first()

                if existing_page:
                    # 3.1 增量融合
                    logger.info(f"Job {job_id}: Entity '{entity}' already exists. Merging contents...")
                    merge_prompt = (
                        f"你是一个专业的维基百科编辑。请将已有的词条内容与新获取的背景资料进行融合，生成一篇更新的、更完善的 Markdown 百科页面。\n\n"
                        f"已知词条【{entity}】的当前内容：\n"
                        f"```markdown\n{existing_page.content}\n```\n\n"
                        f"新获取的背景资料段落：\n"
                        f"```text\n{entity_context}\n```\n\n"
                        f"融合与更新规则：\n"
                        f"1. 保持原有的知识脉络，在原页面基础上补充新的事实、细节、背景或论据，修正过时的说法。\n"
                        f"2. 如果新背景资料与原内容存在明显的矛盾或分歧，请客观地在页面中指出（例如“另有一说...”、“有观点认为...”）。\n"
                        f"3. 保持规范的 Markdown 标题与排版格式，合理添加小标题。\n"
                        f"4. 当提到其他可能存在于 Wiki 中的重要关联概念时，请使用双向链接语法 `[[关联概念]]` 进行标注（例如 `[[耶路撒冷]]` 或 `[[信徒]]`）。\n"
                        f"5. 仅输出更新后的完整 Markdown 内容，不要包含任何前言、后记、Markdown 块包裹标记（如 ```markdown）或任何其他解释。"
                    )
                    
                    merged_content = await call_llm([{"role": "user", "content": merge_prompt}])
                    cleaned_content = clean_markdown_block(merged_content)
                    
                    existing_page.content = cleaned_content
                    existing_page.summary = extract_plain_summary(cleaned_content)
                    existing_page.updated_at = datetime.now()
                    await db.commit()
                    logger.info(f"Job {job_id}: Entity '{entity}' merged successfully.")

                else:
                    # 3.2 全新创建
                    logger.info(f"Job {job_id}: Entity '{entity}' is new. Generating page...")
                    create_prompt = (
                        f"你是一个专业的维基百科编辑。请为概念【{entity}】起草一篇结构严谨、内容丰富的 Markdown 格式百科页面。\n\n"
                        f"背景参考资料：\n"
                        f"```text\n{entity_context}\n```\n\n"
                        f"写作规则：\n"
                        f"1. 页面应当包含：简短定义/概述、背景或来源、详细解释/核心内涵等结构。\n"
                        f"2. 使用清晰的 Markdown 标题结构（如 #, ## 等）。\n"
                        f"3. 在提到其他重要的宗教概念、人物、地点或事件时，请尽可能使用 `[[关联概念]]` 的格式建立双向链接（例如 `[[圣经]]`、`[[耶稣]]`）。\n"
                        f"4. 仅输出完整的 Markdown 内容，不要包含任何前言、后记、Markdown 块包裹标记（如 ```markdown）或任何其他解释。"
                    )
                    
                    new_content = await call_llm([{"role": "user", "content": create_prompt}])
                    cleaned_content = clean_markdown_block(new_content)
                    
                    new_page = WikiPage(
                        title=entity,
                        content=cleaned_content,
                        summary=extract_plain_summary(cleaned_content),
                        created_by=user_id
                    )
                    db.add(new_page)
                    await db.commit()
                    logger.info(f"Job {job_id}: Entity '{entity}' created successfully.")

        # 4. 更新 Job 状态为 completed
        async with SessionLocal() as db:
            job = await db.get(WikiJob, job_id)
            if job:
                job.status = "completed"
                job.log = f"Successfully integrated doc {doc_id}. Extracted and processed {len(entities)} entities: {', '.join(entities)}."
                await db.commit()
        logger.info(f"Wiki integration job {job_id} completed successfully.")

    except Exception as e:
        err_stack = traceback.format_exc()
        logger.error(f"Wiki integration job {job_id} failed: {str(e)}\n{err_stack}")
        
        async with SessionLocal() as db:
            job = await db.get(WikiJob, job_id)
            if job:
                job.status = "failed"
                job.log = f"Error: {str(e)}\n\nTraceback:\n{err_stack}"
                await db.commit()


# ==================== API 路由端点 ====================

@router.get("/pages", response_model=list[WikiPageRead])
async def list_wiki_pages(
    db: SessionDep,
    current_user: CurrentUser,
    query: str | None = Query(default=None, description="搜索关键词，匹配标题或内容"),
    limit: int = 50,
    offset: int = 0,
) -> list[WikiPage]:
    """
    分页列出 Wiki 页面，支持模糊搜索标题或正文。
    """
    stmt = select(WikiPage)
    if query and query.strip():
        search_val = f"%{query.strip()}%"
        stmt = stmt.where(
            sa.or_(
                WikiPage.title.ilike(search_val),
                WikiPage.content.ilike(search_val)
            )
        )
    
    stmt = stmt.order_by(WikiPage.title.asc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/pages/by-title", response_model=WikiPageRead)
async def get_wiki_page_by_title(
    title: str,
    db: SessionDep,
    current_user: CurrentUser,
) -> WikiPage:
    """
    通过标题精确查找 Wiki 页面，便于前端双向链接解析直接点击跳转。
    """
    stmt = select(WikiPage).where(WikiPage.title == title.strip())
    result = await db.execute(stmt)
    page = result.scalars().first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wiki page '{title}' not found"
        )
    return page


@router.get("/pages/{page_id}", response_model=WikiPageRead)
async def get_wiki_page(
    page_id: uuid.UUID,
    db: SessionDep,
    current_user: CurrentUser,
) -> WikiPage:
    """
    获取单个 Wiki 页面详细信息。
    """
    page = await db.get(WikiPage, page_id)
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wiki page not found"
        )
    return page


@router.post("/pages", response_model=WikiPageRead)
async def create_or_update_wiki_page(
    payload: WikiPageCreate,
    db: SessionDep,
    current_user: CurrentUser,
) -> WikiPage:
    """
    创建或完全覆写手动维护的 Wiki 页面（任何登录用户皆可创建/编辑）。
    """
    stmt = select(WikiPage).where(WikiPage.title == payload.title.strip())
    result = await db.execute(stmt)
    page = result.scalars().first()

    summary_text = payload.summary or extract_plain_summary(payload.content)

    if page:
        # 更新
        page.content = payload.content
        page.summary = summary_text
        page.updated_at = datetime.now()
        await db.commit()
        await db.refresh(page)
        return page
    else:
        # 新增
        new_page = WikiPage(
            title=payload.title.strip(),
            content=payload.content,
            summary=summary_text,
            created_by=current_user.id
        )
        db.add(new_page)
        await db.commit()
        await db.refresh(new_page)
        return new_page


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wiki_page(
    page_id: uuid.UUID,
    db: SessionDep,
    current_user: CurrentUser,
) -> None:
    """
    删除 Wiki 页面（Admin-only）。
    """
    # 限制只有管理员能删除 Wiki 页面，保障知识库不被意外破坏
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete wiki pages"
        )

    page = await db.get(WikiPage, page_id)
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wiki page not found"
        )

    await db.delete(page)
    await db.commit()


@router.post("/integrate/{doc_id}", response_model=WikiJobRead, status_code=status.HTTP_202_ACCEPTED)
async def integrate_document(
    doc_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: SessionDep,
    current_user: CurrentUser,
) -> WikiJob:
    """
    一键异步整合某个已解析文档的内容到 Wiki 百科全书中。
    """
    # 从 Request Header 提取 Bearer Token，以便透传调用 gpu-service 接口
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is missing or invalid"
        )
    token = auth_header.split(" ")[1]

    # 请求 gpu-service 获取文档纯文本
    text_url = f"{settings.gpu_service_url.rstrip('/')}/documents/{doc_id}/text"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
            resp = await client.get(text_url, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Failed to fetch document text from gpu-service: {resp.status_code} - {resp.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch document text from GPU service."
                )
            doc_data = resp.json()
            extracted_text = doc_data.get("extracted_text")
            if not extracted_text or not extracted_text.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Document text content is empty, cannot integrate."
                )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error fetching text for integration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reach GPU service: {str(e)}"
        )

    # 1. 创建 WikiJob 记录
    job = WikiJob(
        document_id=doc_id,
        status="pending"
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # 2. 推入后台异步任务
    background_tasks.add_task(
        integrate_document_to_wiki_task,
        job.id,
        doc_id,
        extracted_text,
        current_user.id
    )

    return job


@router.get("/jobs", response_model=list[WikiJobRead])
async def list_wiki_jobs(
    db: SessionDep,
    current_user: CurrentUser,
    limit: int = 20,
) -> list[WikiJob]:
    """
    获取后台 Wiki 整合任务的状态列表。
    """
    stmt = select(WikiJob).order_by(WikiJob.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())
