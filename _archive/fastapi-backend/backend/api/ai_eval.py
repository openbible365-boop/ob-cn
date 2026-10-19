import asyncio
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.core.ai_quota import guard_ai_request
from backend.service.ai import generate_chapter_summary_with_model, explain_tag_with_model

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/eval", tags=["ai-eval"])

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# 多模型评测单次最多并发的模型数（防止单请求放大成本）
_MAX_EVAL_MODELS = 4


# NOTE: n1n.ai 平台上常用的可选模型列表，前端展示用
AVAILABLE_MODELS = [
    {"id": "gpt-4o-mini",                 "label": "GPT-4o Mini",          "provider": "OpenAI"},
    {"id": "gpt-4o",                      "label": "GPT-4o",               "provider": "OpenAI"},
    {"id": "gpt-4.5-preview",             "label": "GPT-4.5 Preview",      "provider": "OpenAI"},
    {"id": "gpt-5-chat-latest",           "label": "GPT-5 (n1n Beta)",     "provider": "OpenAI"},
    {"id": "grok-3",                      "label": "Grok 3",               "provider": "xAI"},
    {"id": "claude-3-5-sonnet-20240620",  "label": "Claude 3.5 Sonnet",    "provider": "Anthropic"},
    {"id": "claude-3-haiku-20240307",     "label": "Claude 3 Haiku",       "provider": "Anthropic"},
    {"id": "claude-sonnet-4-5-20250929",  "label": "Claude Sonnet 4.5",    "provider": "Anthropic"},
    {"id": "claude-opus-4-6",             "label": "Claude Opus 4.6",      "provider": "Anthropic"},
    {"id": "gemma-7b-it",                 "label": "Gemma 7B",             "provider": "Google"},
    {"id": "gemma-2b-it",                 "label": "Gemma 2B",             "provider": "Google"},
    {"id": "deepseek-chat",               "label": "DeepSeek V3",          "provider": "DeepSeek"},
    {"id": "deepseek-reasoner",           "label": "DeepSeek R1",          "provider": "DeepSeek"},
    {"id": "deepseek-v3",                 "label": "DeepSeek V3 (Raw)",    "provider": "DeepSeek"},
    {"id": "deepseek-r1",                 "label": "DeepSeek R1 (Raw)",    "provider": "DeepSeek"},
    {"id": "qwen-max",                    "label": "Qwen Max",             "provider": "Alibaba"},
    {"id": "qwen-plus",                   "label": "Qwen Plus",            "provider": "Alibaba"},
]


class EvalRequest(BaseModel):
    book_code: str
    chapter: int
    models: List[str]   # 模型 id 列表，至少一个
    version: str = "cuv"  # 圣经版本，影响生成语言


@router.get("/models")
async def list_available_models():
    """返回可供评测选择的模型列表"""
    return {"models": AVAILABLE_MODELS}


@router.post("/chapter-summary")
async def eval_chapter_summary(
    payload: EvalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional),
):
    """
    用多个模型并发生成同一章节内容，方便团队对比评测。
    每个模型独立运行，某一个报错不影响其他结果。

    请求示例：
    {
      "book_code": "gen",
      "chapter": 1,
      "models": ["gpt-4o-mini", "grok-3", "claude-opus-4-5"]
    }
    """
    if not payload.models:
        raise HTTPException(status_code=400, detail="至少选择一个模型")
    # 限制模型只能来自白名单 + 单次数量上限，避免任意模型/超大 fan-out 放大成本
    valid_ids = {m["id"] for m in AVAILABLE_MODELS}
    bad = [m for m in payload.models if m not in valid_ids]
    if bad:
        raise HTTPException(status_code=400, detail=f"不支持的模型: {', '.join(bad)}")
    if len(payload.models) > _MAX_EVAL_MODELS:
        raise HTTPException(status_code=400, detail=f"一次最多评测 {_MAX_EVAL_MODELS} 个模型")
    # 准入：IP 限流(全员) + 登录用户月配额 / 匿名日 IP 上限
    await guard_ai_request(request, db, token, metered=True)

    # NOTE: 并发调用所有模型，总耗时取决于最慢的那一个
    tasks = [
        generate_chapter_summary_with_model(
            db=db,
            book_code=payload.book_code,
            chapter=payload.chapter,
            model_name=model,
            version=payload.version,
        )
        for model in payload.models
    ]
    results_raw = await asyncio.gather(*tasks, return_exceptions=True)

    results = []
    for model, raw in zip(payload.models, results_raw):
        if isinstance(raw, Exception):
            # 单个模型异常不阻断整体响应
            logger.warning("eval model %s failed: %s", model, raw)
            results.append({
                "model": model,
                "overview": None,
                "theme_tags": [],
                "explore_chips": [],
                "latency_ms": None,
                "error": str(raw),
            })
        else:
            results.append({
                "model": model,
                "overview": raw.get("overview"),
                "theme_tags": raw.get("theme_tags", []),
                "explore_chips": raw.get("explore_chips", []),
                "latency_ms": raw.get("latency_ms"),
                "error": raw.get("error"),
                "http_status": raw.get("http_status"),
            })

    return {
        "book_code": payload.book_code,
        "chapter": payload.chapter,
        "results": results,
    }

class EvalTagExplainRequest(BaseModel):
    book_code: str
    book_name: str    # NOTE: 前端直接传过来，避免后端在 Serverless 环境中查询 DB
    chapter: int
    tag: str
    model: str
    version: str = "cuv"


@router.post("/tag-explain")
async def eval_tag_explain(
    payload: EvalTagExplainRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional),
):
    """
    评测/查阅专用接口：点击某个模型生成的标签时，直接使用该模型来重新回答。
    已添加数据库缓存机制（下次访问相同标签将直接返回缓存数据）。
    """
    import hashlib
    from backend.repository import ai as ai_repo
    from backend.model.ai import AILog

    # 构建唯一的缓存 Key
    cache_key_str = f"tag-explain:{payload.model}:{payload.version}:{payload.book_code}:{payload.chapter}:{payload.tag}"
    question_hash = hashlib.sha256(cache_key_str.encode("utf-8")).hexdigest()

    # 1. 尝试从数据库获取缓存（命中不计费、不占配额）
    cached = await ai_repo.get_question_cache(db, question_hash)
    if cached:
        return {
            "answer": cached.answer,
            "latency_ms": 0,
            "source": "database"
        }

    # 2. 模型白名单校验 + 准入(限流/配额)
    if payload.model not in {m["id"] for m in AVAILABLE_MODELS}:
        raise HTTPException(status_code=400, detail=f"不支持的模型: {payload.model}")
    user_id = await guard_ai_request(request, db, token, metered=True)

    # 3. 缓存未击中，调用大模型
    res = await explain_tag_with_model(
        book_name=payload.book_name,
        chapter=payload.chapter,
        tag=payload.tag,
        model_name=payload.model,
        version=payload.version
    )

    # 按照已有格式组织返回，如果没有错误，则有 answer 和 latency_ms
    if "error" in res and res["error"]:
        raise HTTPException(status_code=500, detail=res["error"])

    answer = res.get("answer")

    # 4. 将成功的结果写入数据库缓存，并落计费日志（带 user_id，计入月配额）
    if answer:
        await ai_repo.create_question_cache(db, question_hash, cache_key_str, answer)
        db.add(AILog(
            user_id=user_id,
            interaction_type="标签解释",
            prompt_summary=(payload.tag or "")[:80],
            model_name=payload.model,
            latency_ms=res.get("latency_ms") or 0,
        ))
        await db.commit()

    return {
        "answer": answer,
        "latency_ms": res.get("latency_ms"),
        "source": "api"
    }
