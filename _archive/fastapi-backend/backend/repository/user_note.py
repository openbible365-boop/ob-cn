from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from backend.model.user_note import UserNote
from backend.schema.user_note import UserNoteCreate
from typing import List, Optional

async def getUserNotes(db: AsyncSession, userId: int) -> List[UserNote]:
    """
    根据用户 ID 获取该用户的所有灵修笔记
    """
    stmt = select(UserNote).where(UserNote.user_id == userId)
    res = await db.execute(stmt)
    return list(res.scalars().all())

async def batchSyncUserNotes(
    db: AsyncSession, 
    userId: int, 
    notesIn: List[UserNoteCreate]
) -> List[UserNote]:
    """
    批量同步用户的灵修笔记。
    仅执行增量保存（新增或更新），绝不删除数据库中已有的其他笔记。
    """
    # 1. 处理新增与更新
    for note in notesIn:
        stmt = select(UserNote).where(
            UserNote.user_id == userId,
            UserNote.verse_ref == note.verse_ref
        )
        res = await db.execute(stmt)
        existingNote = res.scalars().first()

        if existingNote:
            existingNote.content = note.content
        else:
            newNote = UserNote(
                user_id=userId,
                verse_ref=note.verse_ref,
                content=note.content
            )
            db.add(newNote)

    await db.commit()

    # 2. 获取该用户的全部最新笔记并返回
    return await getUserNotes(db, userId)

async def deleteUserNoteByRef(
    db: AsyncSession,
    userId: int,
    verseRef: str
) -> Optional[UserNote]:
    """
    删除该用户的某条灵修笔记（根据经文或ID标识）
    """
    stmt = select(UserNote).where(
        UserNote.user_id == userId,
        UserNote.verse_ref == verseRef
    )
    res = await db.execute(stmt)
    dbObj = res.scalars().first()
    if dbObj:
        await db.delete(dbObj)
        await db.commit()
    return dbObj
