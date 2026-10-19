from pydantic import BaseModel, Field
from typing import Optional, List, Optional

class VerseBase(BaseModel):
    version: str = Field(..., description="Bible version code, e.g., cuv, kjv", max_length=20)
    book: str = Field(..., description="Book abbreviation, e.g., gen, jhn", max_length=10)
    chapter: int = Field(..., description="Chapter number", gt=0)
    verse_num: int = Field(..., description="Verse number", gt=0)
    text: str = Field(..., description="Verse text content")

class VerseCreate(VerseBase):
    pass

class VerseUpdate(BaseModel):
    version: Optional[str] = Field(None, max_length=20)
    book: Optional[str] = Field(None, max_length=10)
    chapter: Optional[int] = Field(None, gt=0)
    verse_num: Optional[int] = Field(None, gt=0)
    text: Optional[str] = None

class VerseResponse(VerseBase):
    id: int

    class Config:
        from_attributes = True

class VerseBulkImport(BaseModel):
    version: str = Field(..., description="Bible version code, e.g., cuv")
    data: dict = Field(..., description="Hierarchical JSON data: { book: { chapter: [ {verse: 1, text: '...'} ] } }")
