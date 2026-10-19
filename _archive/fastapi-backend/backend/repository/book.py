from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, update
from typing import Optional, List, Optional

from backend.model.book import Book
from backend.schema.book import BookCreate, BookUpdate

async def get_books(db: AsyncSession, version: Optional[str] = None) -> List[Book]:
    """
    Get all books ordered by SN, optionally filtered by version
    """
    stmt = select(Book)
    if version:
        stmt = stmt.filter(Book.version == version)
    result = await db.execute(stmt.order_by(Book.sn))
    return result.scalars().all()

async def get_book_by_id(db: AsyncSession, book_id: int) -> Optional[Book]:
    """
    Get a book by its internal ID
    """
    result = await db.execute(select(Book).filter(Book.id == book_id))
    return result.scalar_one_or_none()

async def get_book_by_code(db: AsyncSession, code: str, version: str) -> Optional[Book]:
    """
    Get a book by its string code and version
    """
    result = await db.execute(select(Book).filter(Book.code == code, Book.version == version))
    return result.scalar_one_or_none()

async def create_book(db: AsyncSession, obj_in: BookCreate) -> Book:
    """
    Create a new book entry
    """
    db_obj = Book(**obj_in.dict())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def update_book(db: AsyncSession, db_obj: Book, obj_in: BookUpdate) -> Book:
    """
    Update a book entry
    """
    update_data = obj_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(db_obj, field, update_data[field])
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def delete_book(db: AsyncSession, db_obj: Book) -> Book:
    """
    Delete a book entry
    """
    await db.delete(db_obj)
    await db.commit()
    return db_obj
