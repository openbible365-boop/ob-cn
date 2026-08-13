from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.core.database import get_db
from backend.model.user import User
from backend.schema.user_note import UserNoteCreate, UserNoteResponse
from backend.repository import user_note as noteRepo
from backend.api.deps import get_current_user

router = APIRouter(prefix="/api/user-notes", tags=["UserNotes"])

@router.post("/sync", response_model=List[UserNoteResponse], status_code=status.HTTP_200_OK)
async def syncUserNotes(
    notesIn: List[UserNoteCreate],
    db: AsyncSession = Depends(get_db),
    currentUser: User = Depends(get_current_user)
) -> List[UserNoteResponse]:
    """
    增量同步用户的个人灵修笔记并返回最新全部笔记记录（安全保存，无自动删除动作）
    """
    return await noteRepo.batchSyncUserNotes(db, userId=currentUser.id, notesIn=notesIn)

@router.delete("/{verse_ref}", response_model=UserNoteResponse)
async def deleteUserNote(
    verse_ref: str,
    db: AsyncSession = Depends(get_db),
    currentUser: User = Depends(get_current_user)
) -> UserNoteResponse:
    """
    删除当前登录用户的某条灵修笔记记录
    """
    from fastapi import HTTPException
    deletedObj = await noteRepo.deleteUserNoteByRef(db, userId=currentUser.id, verseRef=verse_ref)
    if not deletedObj:
        raise HTTPException(status_code=404, detail="未找到对应的笔记")
    return deletedObj
