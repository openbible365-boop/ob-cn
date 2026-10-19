from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func, update, delete
from typing import Optional, List, Optional, Dict, Any
from backend.model.verse import Verse
from backend.schema.verse import VerseCreate, VerseUpdate

async def get_verses(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    version: Optional[str] = None,
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    search: Optional[str] = None
) -> List[Verse]:
    stmt = select(Verse)
    
    if version:
        stmt = stmt.where(Verse.version == version)
    if book:
        stmt = stmt.where(Verse.book == book)
    if chapter:
        stmt = stmt.where(Verse.chapter == chapter)
    if search:
        stmt = stmt.where(Verse.text.ilike(f"%{search}%"))
        
    stmt = stmt.order_by(Verse.id.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def count_verses(
    db: AsyncSession,
    version: Optional[str] = None,
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    search: Optional[str] = None
) -> int:
    stmt = select(func.count(Verse.id))
    
    if version:
        stmt = stmt.where(Verse.version == version)
    if book:
        stmt = stmt.where(Verse.book == book)
    if chapter:
        stmt = stmt.where(Verse.chapter == chapter)
    if search:
        stmt = stmt.where(Verse.text.ilike(f"%{search}%"))
        
    result = await db.execute(stmt)
    return result.scalar_one()

async def get_verse_by_id(db: AsyncSession, verse_id: int) -> Optional[Verse]:
    result = await db.execute(select(Verse).where(Verse.id == verse_id))
    return result.scalars().first()

async def get_verse_by_locator(db: AsyncSession, version: str, book: str, chapter: int, verse_num: int) -> Optional[Verse]:
    result = await db.execute(select(Verse).where(
        Verse.version == version, 
        Verse.book == book, 
        Verse.chapter == chapter, 
        Verse.verse_num == verse_num
    ))
    return result.scalars().first()

async def create_verse(db: AsyncSession, obj_in: VerseCreate) -> Verse:
    db_obj = Verse(**obj_in.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def update_verse(db: AsyncSession, db_obj: Verse, obj_in: VerseUpdate) -> Verse:
    update_data = obj_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(db_obj, field, update_data[field])
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def delete_verse(db: AsyncSession, db_obj: Verse) -> Verse:
    await db.delete(db_obj)
    await db.commit()
    return db_obj

async def bulk_import_verses(db: AsyncSession, version: str, data: Dict[str, Dict[str, List[Dict[str, Any]]]]) -> int:
    """
    Imports verses asynchronously.
    """
    count = 0
    batch_size = 500
    objects_to_add = []
    
    for book_id, chapters in data.items():
        if book_id == "name":
            continue
        for chapter_str, verses_list in chapters.items():
            if chapter_str == "name":
                continue
            try:
                chapter_num = int(chapter_str)
            except ValueError:
                continue
                
            for v_obj in verses_list:
                verse_num = v_obj.get("verse")
                text = v_obj.get("text")
                if verse_num is None or text is None:
                    continue
                
                # Doing it slightly naive for now, could be optimized with batch upserts
                existing = await get_verse_by_locator(db, version, book_id, chapter_num, verse_num)
                if existing:
                    existing.text = text
                    db.add(existing)
                else:
                    new_verse = Verse(
                        version=version,
                        book=book_id,
                        chapter=chapter_num,
                        verse_num=verse_num,
                        text=text
                    )
                    objects_to_add.append(new_verse)
                
                count += 1
                
                if len(objects_to_add) >= batch_size:
                    db.add_all(objects_to_add)
                    await db.commit()
                    objects_to_add = []
                    
    if objects_to_add:
        db.add_all(objects_to_add)
        await db.commit()
        
    return count
