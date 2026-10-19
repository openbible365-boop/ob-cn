from pydantic import BaseModel
from typing import Optional

class ChapterAudioBase(BaseModel):
    version: str
    book: str
    chapter: int
    # NOTE: voice='female'（知性女声）或 'male'（开朗学长），默认由书卷自动推断
    voice: str = 'female'
    audio_url: str
    timestamps: Optional[str] = None

class ChapterAudioCreate(ChapterAudioBase):
    pass

class ChapterAudioUpdate(BaseModel):
    audio_url: Optional[str] = None
    timestamps: Optional[str] = None
    voice: Optional[str] = None

class ChapterAudioResponse(ChapterAudioBase):
    id: int

    class Config:
        from_attributes = True
