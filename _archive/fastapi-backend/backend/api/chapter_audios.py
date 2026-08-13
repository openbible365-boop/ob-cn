from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from backend.core.database import get_db
from backend.model.user import User
from backend.schema.chapter_audio import ChapterAudioCreate, ChapterAudioUpdate, ChapterAudioResponse
from backend.repository import chapter_audio as audio_repo
from backend.api.deps import get_current_admin

router = APIRouter(prefix="/api/audio", tags=["Audio"])

@router.get("/public", response_model=Optional[ChapterAudioResponse])
async def read_audio_public(
    version: str,
    book: str,
    chapter: int,
    voice: Optional[str] = Query(None, description="声音：female / male，默认按书卷推断"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定章节的音频记录（公开）。
    voice 参数可选，默认新约返回 female，旧约返回 male。
    """
    from backend.service.tts import _is_new_testament
    effective_voice = voice if voice in ("female", "male") else (
        "female" if _is_new_testament(book) else "male"
    )
    return await audio_repo.get_audio(
        db, version=version, book=book, chapter=chapter, voice=effective_voice
    )

@router.get("/", response_model=List[ChapterAudioResponse])
async def list_audios(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    version: Optional[str] = Query(None, description="Filter by version"),
    book: Optional[str] = Query(None, description="Filter by book code"),
    chapter: Optional[int] = Query(None, description="Filter by chapter number"),
    voice: Optional[str] = Query(None, description="声音筛选：female / male"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    List all audio entries (Admin only)
    """
    return await audio_repo.get_all_audios(
        db, skip=skip, limit=limit, version=version, book=book, chapter=chapter, voice=voice
    )

@router.post("/", response_model=ChapterAudioResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_audio(
    audio_in: ChapterAudioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Create or update audio for a chapter (Admin only).
    NOTE: 同一章节可以有多个 voice 记录，查重时同时匹配 voice 字段。
    """
    existing = await audio_repo.get_audio(
        db, version=audio_in.version, book=audio_in.book, chapter=audio_in.chapter, voice=audio_in.voice
    )
    if existing:
        return await audio_repo.update_audio(
            db, db_obj=existing, obj_in=ChapterAudioUpdate(
                audio_url=audio_in.audio_url,
                timestamps=audio_in.timestamps
            )
        )
    return await audio_repo.create_audio(db, obj_in=audio_in)

@router.delete("/{audio_id}", response_model=ChapterAudioResponse)
async def delete_audio(
    audio_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Delete an audio entry (Admin only)
    """
    db_obj = await audio_repo.get_audio_by_id(db, audio_id=audio_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Audio entry not found")
    return await audio_repo.delete_audio(db, audio_id=audio_id)

from pydantic import BaseModel
from fastapi import Request
from fastapi.security import OAuth2PasswordBearer
from backend.service.stats_logger import log_user_action

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

class AudioPlayReport(BaseModel):
    book: str
    chapter: int
    version: str
    duration: int
    playback_rate: float = 1.0

@router.post("/report-play")
async def report_audio_play(
    request: Request,
    report: AudioPlayReport,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional)
):
    """
    供前端在音频播放完成或中断时上报收听记录使用
    """
    user_id = None
    if token:
        from backend.service.auth import decode_access_token
        try:
            payload = decode_access_token(token)
            if payload and "sub" in payload:
                user_id = int(payload["sub"])
        except Exception:
            pass

    ip = request.client.host if request.client else None
    log_user_action(
        db=db,
        action_type="audio_complete",
        user_id=user_id,
        book=report.book,
        chapter=report.chapter,
        version_used=report.version,
        duration=report.duration,
        playback_rate=report.playback_rate,
        ip_address=ip
    )
    return {"status": "ok"}
