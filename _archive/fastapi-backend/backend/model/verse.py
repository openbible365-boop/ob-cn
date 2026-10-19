from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from backend.core.database import Base

class Verse(Base):
    """
    Bible Verse Database Model
    """
    __tablename__ = "verses"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(20), index=True, nullable=False) # e.g., 'cuv', 'kjv'
    book = Column(String(10), index=True, nullable=False)    # e.g., 'gen', 'jhn'
    chapter = Column(Integer, index=True, nullable=False)    # e.g., 1, 2
    verse_num = Column(Integer, index=True, nullable=False)  # e.g., 1, 2
    text = Column(Text, nullable=False)                      # The actual verse text

    # Ensure no duplicate verse for a specific version, book, chapter, and verse_num
    __table_args__ = (
        UniqueConstraint('version', 'book', 'chapter', 'verse_num', name='uq_verse_locator'),
    )
