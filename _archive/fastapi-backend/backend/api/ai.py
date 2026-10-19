from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.repository import ai as ai_repo, study_note as note_repo
from backend.service import ai as ai_service
from backend.schema.ai import VerseAnalysisResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])

import time
import hashlib
from typing import Any
from pydantic import BaseModel
from fastapi import Request
from fastapi.security import OAuth2PasswordBearer
from backend.model.ai import AILog

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

@router.get("/summary/{verse_ref}", response_model=VerseAnalysisResponse)
async def get_verse_summary(
    request: Request,
    verse_ref: str, 
    text: str = "", 
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional)
):
    """
    获取经文解析。先查库，没有则调用大模型并存库。
    verse_ref: 如 gen-1-1
    text: 可选，该节经文的内容，用来辅助 AI 分析
    """
    # 1. 查库（命中直接返回，不限流不计费）
    existing = await ai_repo.get_analysis_by_ref(db, verse_ref)
    if existing:
        return VerseAnalysisResponse(
            verse_ref=existing.verse_ref,
            content=existing.content,
            source="db"
        )

    # 准入：仅对要真正调模型的请求做 IP 限流(兜底)；同时解析 user_id 用于日志
    # （经文解析按 verse_ref 有界且会落库缓存，不计入每月对话配额 → metered=False）
    from backend.core.ai_quota import guard_ai_request
    user_id = await guard_ai_request(request, db, token, metered=False)

    # 2. 如果没有，优先尝试获取精读本数据作为参考
    study_note = await note_repo.get_study_note_by_ref(db, verse_ref)
    study_context = study_note.content if study_note else ""

    # 3. 调用 Gemini 生成并计时
    start_t = time.time()
    ai_resp = await ai_service.explain_verse(verse_ref, text, study_context)
    latency_ms = int((time.time() - start_t) * 1000)
    
    new_content = ai_resp.get("text", "")
    t_in = ai_resp.get("tokens_in", 0)
    t_out = ai_resp.get("tokens_out", 0)
    prompt_used = ai_resp.get("prompt", "")
    prompt_summary = prompt_used[:80] + "..." if len(prompt_used) > 80 else prompt_used

    # 4. 存大模型解析缓存库
    if t_in > 0 or t_out > 0:
        await ai_repo.create_analysis(db, verse_ref, new_content)
    
    # 5. 存入 AI 调用明细表日志 (AILog)
    ai_log_entry = AILog(
        user_id=user_id,
        interaction_type="经文解析",
        prompt_summary=prompt_summary,
        reference=verse_ref,
        model_name="gemini-1.5-flash",
        tokens_in=t_in,
        tokens_out=t_out,
        latency_ms=latency_ms
    )
    db.add(ai_log_entry)
    await db.commit()
    
    return VerseAnalysisResponse(
        verse_ref=verse_ref,
        content=new_content,
        source="gemini"
    )


class QuestionRequest(BaseModel):
    question: str
    context: str = ""      # 可选：当前阅读的经文引用
    stage_level: int = 2   # 用户灵命阶段等级 1-6，默认 2（初信者）
    version: str = "cuv"   # 圣经版本，用于确定回答语言


@router.post("/question", response_model=Any)
async def ask_question(
    payload: QuestionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional),
):
    """
    问答接口（接入 n1n.ai）：
    1. 计算问题 SHA256，查询 AIQuestionCache 缓存
    2. 命中 → 直接返回缓存（source=cache）
    3. 未命中 → 准入校验(限流/配额) → 调用 n1n.ai → 存缓存 → 返回（source=n1n）
    """
    question = payload.question.strip()
    if not question:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="问题不能为空")

    # NOTE: 用 SHA256 做问题哈希，确保相同问题稳定映射到同一 key
    question_hash = hashlib.sha256(question.encode("utf-8")).hexdigest()

    # 1. 查缓存（命中不计费、不占配额）
    cached = await ai_repo.get_question_cache(db, question_hash)
    if cached:
        return {"answer": cached.answer, "source": "cache"}

    # 2. 准入：IP 限流(全员) + 登录用户按套餐月配额 / 匿名按日 IP 上限（仅对真正要调模型的请求）
    from backend.core.ai_quota import guard_ai_request
    user_id = await guard_ai_request(request, db, token, metered=True)

    # 3. 调用 n1n.ai（根据 stage_level 路由 Claude / Grok）
    start_t = time.time()
    answer, model_used = await ai_service.ask_bible_question(
        question, payload.context, stage_level=payload.stage_level, version=payload.version
    )
    latency_ms = int((time.time() - start_t) * 1000)

    # 4. 写入缓存（只有非错误回答才缓存）
    if answer and not answer.startswith("系统未配置") and not answer.startswith("API 请求失败") and not answer.startswith("AI 服务暂时不可用"):
        await ai_repo.create_question_cache(db, question_hash, question, answer)

    # 5. 记录日志（带 user_id，用于月配额计数）
    ai_log_entry = AILog(
        user_id=user_id,
        interaction_type="自由问答",
        prompt_summary=question[:80] + ("..." if len(question) > 80 else ""),
        model_name=model_used,
        latency_ms=latency_ms
    )
    db.add(ai_log_entry)
    await db.commit()

    return {"answer": answer, "source": model_used}

@router.get("/chapter-summary/{book_code}/{chapter}")
async def get_or_generate_chapter_summary(
    book_code: str,
    chapter: int,
    version: str = "cuv",
    force: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定章节的速览、探索问题及主题标签。
    如果数据库中没有（或 force=true），则调用AI生成一次并存入数据库。
    """
    import json
    # 确立新生成的语言和对应的推断模型
    if version == "kjv":
        language = "en"
        target_model = "claude-haiku-4-5-20251001"
    elif version in ("keb", "krv", "snr"):
        language = "ko"
        target_model = "glm-4.7"
    else:
        language = "zh"
        target_model = "qwen-plus"

    # 1. 查数据库是否存在已有的速览
    existing_summary = await ai_repo.get_chapter_summary(db, book_code, chapter, version)
    if existing_summary and not force and getattr(existing_summary, "language", "zh") == language:
        explore_chips = []
        if existing_summary.explore_questions:
            try:
                explore_chips = json.loads(existing_summary.explore_questions)
            except:
                pass
        theme_tags = []
        if existing_summary.theme_tags:
            try:
                theme_tags = json.loads(existing_summary.theme_tags)
            except:
                pass
        return {
            "answer": existing_summary.content,
            "explore_chips": explore_chips,
            "theme_tags": theme_tags,
            "source": "database"
        }
    generated_data = await ai_service.generate_chapter_summary_with_model(
        db, book_code, chapter, target_model, version
    )
    overview_text = generated_data.get("overview", "")
    explore_chips = generated_data.get("explore_chips", [])
    theme_tags = generated_data.get("theme_tags", [])
    
    # 3. 将新的速览存库，除非返回的是错误占位提示
    if overview_text and "摘要暂不可用" not in overview_text and "系统未配置" not in overview_text:
        explore_str = json.dumps(explore_chips, ensure_ascii=False) if explore_chips else None
        tags_str = json.dumps(theme_tags, ensure_ascii=False) if theme_tags else None
        
        # NOTE: 统一使用 upsert_chapter_summary 更新已有记录以防在数据库中产生多条记录，没有则新建
        await ai_repo.upsert_chapter_summary(
            db, book_code, chapter, overview_text,
            explore_str, tags_str, version, language
        )
        
    return {
        "answer": overview_text,
        "explore_chips": explore_chips,
        "theme_tags": theme_tags,
        "source": target_model
    }
