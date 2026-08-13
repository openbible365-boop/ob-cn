from sqlalchemy import Column, Integer, String, SmallInteger, UniqueConstraint
from backend.core.database import Base

class Book(Base):
    """
    Bible Book Catalogue Model (Multi-version support)
    """
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(20), index=True, nullable=False) # e.g., 'cuv', 'kjv'
    sn = Column(Integer, index=True, nullable=False) # Order 1-66 within a version
    code = Column(String(10), index=True, nullable=False) # gen, exo...
    full_name = Column(String(50), nullable=False)
    short_name = Column(String(20), nullable=False)
    chapter_count = Column(Integer, nullable=False)
    new_old = Column(SmallInteger, default=0) # 0 for OT, 1 for NT

    __table_args__ = (
        UniqueConstraint('version', 'sn', name='uq_book_version_sn'),
        UniqueConstraint('version', 'code', name='uq_book_version_code'),
    )
