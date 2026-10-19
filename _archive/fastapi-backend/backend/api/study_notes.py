from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Optional

from backend.core.database import get_db
from backend.model.user import User
from backend.schema.study_note import StudyNoteCreate, StudyNoteUpdate, StudyNoteResponse
from backend.repository import study_note as note_repo
from backend.api.deps import get_current_admin

router = APIRouter(prefix="/api/study-notes", tags=["StudyNotes"])

@router.get("/", response_model=List[StudyNoteResponse])
async def list_study_notes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    List all study notes (Admin only)
    """
    return await note_repo.get_all_study_notes(db, skip=skip, limit=limit)

@router.post("/", response_model=StudyNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_study_note(
    note_in: StudyNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Create or update study note for a verse (Admin only)
    """
    existing = await note_repo.get_study_note_by_ref(db, note_in.verse_ref)
    if existing:
        return await note_repo.update_study_note(
            db, db_obj=existing, obj_in=StudyNoteUpdate(content=note_in.content)
        )
    return await note_repo.create_study_note(db, obj_in=note_in)

@router.post("/batch", response_model=List[StudyNoteResponse])
async def batch_create_notes(
    notes_in: List[StudyNoteCreate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Batch create or update study notes (Admin only)
    """
    return await note_repo.batch_create_study_notes(db, notes_in=notes_in)

@router.delete("/{note_id}", response_model=StudyNoteResponse)
async def delete_study_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Delete a study note (Admin only)
    """
    db_obj = await note_repo.get_study_note_by_id(db, note_id=note_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Study note not found")
    return await note_repo.delete_study_note(db, note_id=note_id)

@router.get("/{verse_ref}", response_model=Optional[StudyNoteResponse])
async def get_study_note_by_ref(
    verse_ref: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get study note for a specific verse (Public)
    """
    return await note_repo.get_study_note_by_ref(db, verse_ref=verse_ref)
