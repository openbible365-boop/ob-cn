from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from backend.model.study_note import StudyNote
from backend.schema.study_note import StudyNoteCreate, StudyNoteUpdate
from typing import Optional, List, Optional

async def get_study_note_by_ref(db: AsyncSession, verse_ref: str) -> Optional[StudyNote]:
    result = await db.execute(
        select(StudyNote).where(StudyNote.verse_ref == verse_ref)
    )
    return result.scalars().first()

async def get_all_study_notes(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100
) -> List[StudyNote]:
    result = await db.execute(
        select(StudyNote).offset(skip).limit(limit)
    )
    return result.scalars().all()

async def create_study_note(db: AsyncSession, obj_in: StudyNoteCreate) -> StudyNote:
    db_obj = StudyNote(
        verse_ref=obj_in.verse_ref,
        content=obj_in.content
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def update_study_note(
    db: AsyncSession, 
    db_obj: StudyNote, 
    obj_in: StudyNoteUpdate
) -> StudyNote:
    if obj_in.content is not None:
        db_obj.content = obj_in.content
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def delete_study_note(db: AsyncSession, note_id: int) -> Optional[StudyNote]:
    result = await db.execute(select(StudyNote).where(StudyNote.id == note_id))
    db_obj = result.scalars().first()
    if db_obj:
        await db.delete(db_obj)
        await db.commit()
    return db_obj

async def get_study_note_by_id(db: AsyncSession, note_id: int) -> Optional[StudyNote]:
    result = await db.execute(select(StudyNote).where(StudyNote.id == note_id))
    return result.scalars().first()

async def batch_create_study_notes(db: AsyncSession, notes_in: List[StudyNoteCreate]) -> List[StudyNote]:
    """
    Batch create or update study notes.
    """
    results = []
    for note_in in notes_in:
        # Check if exists
        stmt = select(StudyNote).where(StudyNote.verse_ref == note_in.verse_ref)
        res = await db.execute(stmt)
        existing = res.scalars().first()
        
        if existing:
            existing.content = note_in.content
            results.append(existing)
        else:
            db_obj = StudyNote(
                verse_ref=note_in.verse_ref,
                content=note_in.content
            )
            db.add(db_obj)
            results.append(db_obj)
    
    await db.commit()
    for obj in results:
        # Avoid refresh if already in session but potentially stale... actually refresh is safer
        await db.refresh(obj)
    return results
