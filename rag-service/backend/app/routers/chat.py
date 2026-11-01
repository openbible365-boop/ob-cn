import json
import logging
import uuid
import queue
import threading
import asyncio
from typing import AsyncGenerator

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.deps import CurrentUser, SessionDep
from app.models import ChatMessage, ChatSession, WikiPage
from app.rag import get_query_embedding, retrieve_relevant_chunks
from app.schemas import (
    ChatCompletionRequest,
    ChatSessionCreate,
    ChatSessionRead,
    ChatMessageRead,
)

router = APIRouter(prefix="/chat", tags=["chat"])

logger = logging.getLogger(__name__)

def sanitize_messages(messages: list[dict]) -> list[dict]:
    """
    清洗消息历史，确保 role 必须交替（如 user -> assistant -> user），且不含连续的同 role 消息。
    如果存在连续的同 role 消息，将内容合并。
    """
    if not messages:
        return []

    cleaned = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")

        if not content:
            continue

        if cleaned and cleaned[-1]["role"] == role:
            cleaned[-1]["content"] += f"\n{content}"
        else:
            cleaned.append({"role": role, "content": content})

    return cleaned

@router.post("/sessions", response_model=ChatSessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: ChatSessionCreate,
    db: SessionDep,
    current_user: CurrentUser,
) -> ChatSession:
    """
    新建一个聊天会话
    """
    session = ChatSession(
        title=payload.title,
        user_id=current_user.id
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=list[ChatSessionRead])
async def list_sessions(
    db: SessionDep,
    current_user: CurrentUser,
    limit: int = 50,
    offset: int = 0,
) -> list[ChatSession]:
    """
    获取当前用户的会话列表
    """
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageRead])
async def get_session_messages(
    session_id: uuid.UUID,
    db: SessionDep,
    current_user: CurrentUser,
) -> list[ChatMessage]:
    """
    获取某会话下的所有历史消息
    """
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    db: SessionDep,
    current_user: CurrentUser,
) -> None:
    """
    删除会话（级联删除所有消息）
    """
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    await db.delete(session)
    await db.commit()


def sync_urllib_stream(
    api_url: str,
    headers: dict,
    payload: dict,
    result_queue: queue.Queue
):
    """
    在独立的后台线程中以同步 urllib 方式请求大模型，并将读到的行写入队列
    """
    import urllib.request
    import json

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(api_url, data=data, headers=headers, method="POST")

    try:
        # 强制禁用任何代理，完全排除系统代理拦截
        proxy_handler = urllib.request.ProxyHandler({})
        opener = urllib.request.build_opener(proxy_handler)

        # NOTE: timeout 设为 300s，防止 GPU 服务器推理排队时超过 30s 导致连接中断
        with opener.open(req, timeout=300.0) as response:
            if response.status != 200:
                result_queue.put(("error", f"LLM API returned status {response.status}"))
                return

            while True:
                line = response.readline()
                if not line:
                    break
                line_str = line.decode("utf-8").strip()
                if line_str:
                    result_queue.put(("data", line_str))
        result_queue.put(("done", None))
    except Exception as e:
        result_queue.put(("error", str(e)))


async def stream_chat_completions(
    session_id: uuid.UUID,
    messages_payload: list[dict],
    model: str,
) -> AsyncGenerator[str, None]:
    """
    流式向 OpenAI 接口请求对话回复，并将完整的 assistant 回复保存至数据库。
    通过线程池运行 urllib 以解决 httpx 在代理网卡下可能被死锁的兼容性问题。
    """
    api_url = f"{settings.openai_api_base.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
    }
    if settings.openai_api_key:
        headers["Authorization"] = f"Bearer {settings.openai_api_key}"

    payload = {
        "model": model,
        "messages": messages_payload,
        "stream": True,
        # NOTE: 禁用 Qwen3 的思考链模式，避免 <think>...</think> 标签出现在用户回复中
        "chat_template_kwargs": {"enable_thinking": False},
    }

    full_assistant_reply = []
    logger.info(f"LLM Stream (urllib): URL: {api_url}, model: {model}")

    # 创建一个线程安全的队列
    q = queue.Queue()

    # 启动后台线程执行 urllib 请求
    t = threading.Thread(
        target=sync_urllib_stream,
        args=(api_url, headers, payload, q),
        daemon=True
    )
    t.start()

    # 在异步事件循环中轮询队列。每次循环把目前队列积压的所有行一次性全部吐出来，
    # 仅在队列完全为空时休眠极短的 2ms 释放 CPU。这比每次 sleep 50ms 速度提升数倍。
    has_saved = False

    async def save_assistant_reply():
        nonlocal has_saved
        if has_saved:
            return
        assistant_content = "".join(full_assistant_reply)
        if assistant_content.strip():
            try:
                async with SessionLocal() as db_session:
                    assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=assistant_content
                    )
                    db_session.add(assistant_msg)
                    session = await db_session.get(ChatSession, session_id)
                    if session:
                        session.updated_at = sa.func.now()
                    await db_session.commit()
                logger.info(f"Saved assistant message to db for session {session_id}")
            except Exception as e:
                logger.error(f"Failed to save assistant message to db: {e}")
        has_saved = True

    should_exit = False
    try:
        while True:
            has_data = False
            while True:
                try:
                    item_type, val = q.get_nowait()
                    has_data = True
                    logger.info(f"CONSUME QUEUE: type={item_type}, val={repr(val)}")
                    if item_type == "error":
                        logger.error(f"Error in urllib stream thread: {val}")
                        yield f"data: {json.dumps({'error': val})}\n\n"
                        should_exit = True
                        break
                    elif item_type == "done":
                        # 1. TCP 物理连接断开/流读取完毕的 done 兜底信号，进行安全保存
                        await save_assistant_reply()
                        should_exit = True
                        break
                    elif item_type == "data":
                        # 2. SSE 协议层主动发出的 [DONE] 标记，进行抢先保存
                        val_strip = val.strip()
                        if val_strip.startswith("data:") and val_strip[5:].strip() == "[DONE]":
                            await save_assistant_reply()
                            yield f"{val}\n\n"
                            should_exit = True
                            break
                        
                        # 正常的流式数据 yield 与内容累加
                        yield f"{val}\n\n"
                        if val_strip.startswith("data:"):
                            data_str = val_strip[5:].strip()
                            try:
                                data_json = json.loads(data_str)
                                delta = data_json.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    full_assistant_reply.append(content)
                            except Exception:
                                pass
                except queue.Empty:
                    break
            if should_exit:
                break
            if not has_data:
                # 仅在无数据时做极小休眠让出 CPU
                await asyncio.sleep(0.002)
    finally:
        # 在 finally 兜底中执行最后的物理持久化。
        # 无论协程是正常退出还是被 Starlette 取消销毁（GeneratorExit），此 finally 块 100% 确保被触发并提交事务
        await save_assistant_reply()


@router.post("/completions")
async def chat_completions(
    payload: ChatCompletionRequest,
    db: SessionDep,
    current_user: CurrentUser,
) -> StreamingResponse:
    """
    发送消息对话接口，支持流式 SSE 返回
    """
    model_name = payload.model or settings.llm_default_model
    session_id = payload.session_id

    # 1. 确认或创建会话
    if not session_id:
        title = payload.message[:30] + ("..." if len(payload.message) > 30 else "")
        session = ChatSession(title=title, user_id=current_user.id)
        db.add(session)
        await db.commit()
        await db.refresh(session)
        session_id = session.id
    else:
        session = await db.get(ChatSession, session_id)
        if not session or session.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

    # 2. 保存用户消息
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=payload.message
    )
    db.add(user_msg)
    await db.commit()

    # 3. 拉取当前会话的所有历史消息，组成 messages 数组
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    history_messages = result.scalars().all()

    messages_payload = []

    # 4. 如果启用了 RAG 知识库，直接调用本服务的 Qdrant + Reranker 检索链。
    if payload.use_rag:
        try:
            logger.info(f"RAG retrieval enabled for message: '{payload.message}'")
            query_embedding = await get_query_embedding(payload.message)
            scored_chunks = await retrieve_relevant_chunks(
                db,
                query_embedding,
                payload.message,
                current_user.id,
                limit=settings.rag_top_k,
                threshold=settings.rag_similarity_threshold,
            )

            if scored_chunks:
                logger.info(f"RAG retrieved {len(scored_chunks)} relevant chunks")
                context_str = ""
                for idx, (chunk, score) in enumerate(scored_chunks):
                    source = chunk.document.title or chunk.document.filename
                    locator = f"，第 {chunk.page_number} 页" if chunk.page_number else ""
                    section = f"，{chunk.section_title}" if chunk.section_title else ""
                    context_str += (
                        f"[{idx + 1}] 来源: {source}{locator}{section} (相关度: {score:.2f})\n"
                        f"内容: {chunk.content}\n\n"
                    )

                system_prompt = (
                    "你是一个精通背景资料的知识整理助手。\n"
                    "请结合以下背景资料（可能包含多个不同的文档）综合、有条理地回答用户的问题。\n\n"
                    "【核心回答规则】\n"
                    "1. **综合整理**：如果背景资料来自多个不同的文档，请对这些文档中的相关信息进行归纳和整理，分条列出，使其结构和逻辑清晰。\n"
                    "2. **准确引用出处**：你在回答中所采纳的每一条事实或观点，如果确实来自背景资料，必须在相关句子的末尾标明具体出处，格式为 `[来源: 文档名，第 N 页]`；没有页码时省略页码。多个来源请并列标注。\n"
                    "3. **杜绝虚假引用（最重要）**：如果提供的背景资料与问题无关、没有提到，或者该部分回答内容完全来自于你自身的预训练知识库而非背景资料，请在回答中明确说明该内容并非来自背景资料，并且绝对不要在这些句子后面添加任何 `[来源: 文档名]` 格式的标识。\n"
                    "4. 如果背景资料与用户提问完全无关或没有提到，请直接在回答开头说明“在您上传的背景资料中未找到相关解释，以下为您提供常规参考：”，然后再根据你自身的知识进行回答。\n\n"
                    f"背景资料：\n{context_str.strip()}"
                )
                messages_payload.append({"role": "system", "content": system_prompt})
            else:
                logger.info("RAG retrieval executed, but no relevant chunks found above threshold")
        except Exception as e:
            logger.error("Failed to perform RAG retrieval", exc_info=True)
            # 检索失败时，作为降级方案，只记录日志，不阻断正常对话

        # 5. 如果启用了 Wiki 知识库检索，从 backend 的 wiki_pages 中匹配出 2-3 个最相关的词条
        if payload.use_wiki_rag:
            try:
                logger.info(f"Wiki retrieval enabled for message: '{payload.message}'")
                
                # 对用户 query 进行词条匹配
                query_words = [w.strip() for w in payload.message.split() if len(w.strip()) > 1]
                if not query_words:
                    query_words = [c for c in payload.message if c.strip()]
                
                wiki_stmt = select(WikiPage)
                if query_words:
                    or_conditions = []
                    for word in query_words[:5]:  # 限制前5个词，防止 sql 过长
                        or_conditions.append(WikiPage.title.ilike(f"%{word}%"))
                        or_conditions.append(WikiPage.content.ilike(f"%{word}%"))
                    if or_conditions:
                        wiki_stmt = wiki_stmt.where(sa.or_(*or_conditions))
                
                wiki_stmt = wiki_stmt.limit(3)
                async with SessionLocal() as db_session:
                    wiki_result = await db_session.execute(wiki_stmt)
                    matched_pages = wiki_result.scalars().all()
                
                if matched_pages:
                    logger.info(f"Wiki retrieved {len(matched_pages)} relevant pages")
                    wiki_context_str = ""
                    for idx, page in enumerate(matched_pages):
                        wiki_context_str += f"[{idx + 1}] 词条名: {page.title}\n内容: {page.content}\n\n"
                    
                    wiki_system_prompt = (
                        "你是一个精通背景百科的助手。请结合以下 Wiki 百科词条回答用户的问题。\n"
                        "【核心回答规则】\n"
                        "1. 请优先基于 Wiki 百科词条中的信息解答用户提问。\n"
                        "2. 每一个回答采纳的 Wiki 词条，必须在相关的句子末尾标明引用的百科来源，格式为 `[来源: Wiki - 词条名]`。\n\n"
                        f"Wiki 词条背景资料：\n{wiki_context_str.strip()}"
                    )
                    messages_payload.append({"role": "system", "content": wiki_system_prompt})
                else:
                    logger.info("Wiki retrieval executed, but no relevant pages found")
            except Exception as e:
                logger.error("Failed to perform Wiki retrieval", exc_info=True)

    raw_history = []
    for msg in history_messages:
        raw_history.append({"role": msg.role, "content": msg.content})

    # 清洗历史消息，确保角色交替，防止连续的 user 消息导致 vLLM 模板解析死锁
    messages_payload.extend(sanitize_messages(raw_history))

    return StreamingResponse(
        stream_chat_completions(
            session_id=session_id,
            messages_payload=messages_payload,
            model=model_name
        ),
        media_type="text/event-stream"
    )
