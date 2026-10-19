from pydantic import BaseModel
from typing import Optional

class StudyNoteBase(BaseModel):
    verse_ref: str
    content: str

class StudyNoteCreate(StudyNoteBase):
    pass

class StudyNoteUpdate(BaseModel):
    content: Optional[str] = None

class StudyNoteResponse(StudyNoteBase):
    id: int

    class Config:
        from_attributes = True
