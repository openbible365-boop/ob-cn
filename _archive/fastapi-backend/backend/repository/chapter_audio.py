from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from backend.model.chapter_audio import ChapterAudio
from backend.schema.chapter_audio import ChapterAudioCreate, ChapterAudioUpdate
from typing import Optional, List

async def get_audio(
    db: AsyncSession,
    version: str,
    book: str,
    chapter: int,
    voice: Optional[str] = None,     # NOTE: None 表示不限声音，返回第一条匹配
) -> Optional[ChapterAudio]:
    query = select(ChapterAudio).where(
        ChapterAudio.version == version,
        ChapterAudio.book == book,
        ChapterAudio.chapter == chapter,
    )
    if voice:
        query = query.where(ChapterAudio.voice == voice)
    result = await db.execute(query)
    return result.scalars().first()

async def get_all_audios(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    version: Optional[str] = None,
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    voice: Optional[str] = None,
) -> List[ChapterAudio]:
    query = select(ChapterAudio)
    if version:
        query = query.where(ChapterAudio.version == version)
    if book:
        query = query.where(ChapterAudio.book == book)
    if chapter is not None:
        query = query.where(ChapterAudio.chapter == chapter)
    if voice:
        query = query.where(ChapterAudio.voice == voice)

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

async def create_audio(db: AsyncSession, obj_in: ChapterAudioCreate) -> ChapterAudio:
    db_obj = ChapterAudio(
        version=obj_in.version,
        book=obj_in.book,
        chapter=obj_in.chapter,
        voice=obj_in.voice,
        audio_url=obj_in.audio_url,
        timestamps=obj_in.timestamps
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def update_audio(
    db: AsyncSession,
    db_obj: ChapterAudio,
    obj_in: ChapterAudioUpdate
) -> ChapterAudio:
    if obj_in.audio_url is not None:
        db_obj.audio_url = obj_in.audio_url
    if obj_in.timestamps is not None:
        db_obj.timestamps = obj_in.timestamps
    if obj_in.voice is not None:
        db_obj.voice = obj_in.voice
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def delete_audio(db: AsyncSession, audio_id: int) -> Optional[ChapterAudio]:
    result = await db.execute(select(ChapterAudio).where(ChapterAudio.id == audio_id))
    db_obj = result.scalars().first()
    if db_obj:
        await db.delete(db_obj)
        await db.commit()
    return db_obj

async def get_audio_by_id(db: AsyncSession, audio_id: int) -> Optional[ChapterAudio]:
    result = await db.execute(select(ChapterAudio).where(ChapterAudio.id == audio_id))
    return result.scalars().first()
