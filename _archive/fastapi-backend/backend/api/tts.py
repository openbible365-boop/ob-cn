"""
豆包 TTS API 端点

GET /api/audio/tts?version=cuv&book=gen&chapter=1&voice=male
- 仅支持 version=cuv；其他版本返回 { supported: false }
- voice='female'（知性女声）或 'male'（开朗学长），默认按书卷自动推断
- 优先读取数据库 / S3 缓存，未命中时实时调用豆包合成
- 返回 { url, timestamps, voice, voice_label, supported, cached, mock }
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.service.tts import (
    synthesize_chapter,
    MOCK_AUDIO_FALLBACK_URL,
    _is_new_testament,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audio", tags=["TTS"])


@router.get("/tts")
async def get_tts_audio(
    version: str = Query(..., description="圣经版本，仅支持 cuv"),
    book: str = Query(..., description="书卷代码，如 gen、mat"),
    chapter: int = Query(..., ge=1, description="章序号"),
    voice: Optional[str] = Query(None, description="声音：female（知性女声）或 male（开朗学长），默认按书卷自动推断"),
    db: AsyncSession = Depends(get_db),
):
    """
    按需合成整章 TTS 音频（仅 CUV 版本）。

    voice 参数：
      - female → 知性女声（新约默认）
      - male   → 开朗学长（旧约默认）
      - 不传   → 按书卷自动推断

    返回字段：
    - supported: 是否支持 TTS
    - url: 音频 URL
    - timestamps: 节级时间轴
    - voice: 使用的声音标识
    - voice_label: 声音中文名称
    - cached: 是否来自缓存
    - mock: 是否为模拟模式（无凭证）
    """
    # 非 CUV 版本直接返回不支持
    if version.lower() != "cuv":
        return {
            "supported": False,
            "url": None,
            "cached": False,
            "mock": False,
            "voice": None,
            "voice_label": None,
            "version": version,
            "book": book,
            "chapter": chapter,
            "message": f"TTS 仅支持 CUV（和合本）版本，当前版本 '{version}' 不支持",
        }

    # voice 参数校验
    if voice and voice not in ("female", "male"):
        raise HTTPException(status_code=400, detail="voice 参数只能为 'female' 或 'male'")

    # NOTE: 未传 voice 时：新约按系统设置 TTS_DEFAULT_VOICE，旧约始终 male
    from backend.core.config import settings as app_settings
    if voice and voice not in ("female", "male"):
        raise HTTPException(status_code=400, detail="voice 参数只能为 'female' 或 'male'")

    if voice:
        effective_voice = voice
    else:
        effective_voice = app_settings.TTS_DEFAULT_VOICE if _is_new_testament(book) else "male"

    voice_label = "知性女声" if effective_voice == "female" else "开朗学长"
    testament_label = "新约" if _is_new_testament(book) else "旧约"

    # 从 JSON 仓库读取经文文本
    from backend.repository.json_verse import json_verse_repo
    all_verses = json_verse_repo._get_book_verses(version, book)
    rows = [v for v in all_verses if v['chapter'] == chapter]

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"未找到经文：{version}/{book}/{chapter}",
        )

    verses_data = [{"verse": v['verse_num'], "text": v['text']} for v in rows]

    # 调用 TTS service（传入 voice 和 db）
    audio_url, timestamps = await synthesize_chapter(
        version, book, chapter, verses_data, db=db, voice=effective_voice
    )

    if not audio_url:
        raise HTTPException(
            status_code=503,
            detail="TTS 合成失败，请稍后重试",
        )

    # 检查是否来自缓存
    from backend.repository import chapter_audio as audio_repo
    db_record = await audio_repo.get_audio(
        db, version=version, book=book, chapter=chapter, voice=effective_voice
    )
    is_cached = db_record is not None
    is_mock = audio_url == MOCK_AUDIO_FALLBACK_URL

    return {
        "supported": True,
        "url": audio_url,
        "timestamps": timestamps,
        "cached": is_cached,
        "mock": is_mock,
        "voice": effective_voice,
        "voice_label": voice_label,
        "testament": testament_label,
        "version": version,
        "book": book,
        "chapter": chapter,
        "verse_count": len(verses_data),
    }
