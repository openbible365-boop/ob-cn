from sqlalchemy import Column, Integer, String, UniqueConstraint
from backend.core.database import Base

class ChapterAudio(Base):
    """
    Bible Chapter Audio Database Model
    """
    __tablename__ = "chapter_audios"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(20), index=True, nullable=False) # e.g., 'cuv', 'kjv'
    book = Column(String(10), index=True, nullable=False)    # e.g., 'gen', 'jhn'
    chapter = Column(Integer, index=True, nullable=False)    # e.g., 1, 2
    # NOTE: voice 区分声音，'female'=知性女声（新约默认）, 'male'=开朗学长（旧约默认）
    voice = Column(String(20), index=True, nullable=False, default='female')
    audio_url = Column(String(500), nullable=False)         # Link to the audio file
    timestamps = Column(String, nullable=True)               # JSON list of timestamps (seconds)

    # Ensure uniqueness per chapter + voice
    __table_args__ = (
        UniqueConstraint('version', 'book', 'chapter', 'voice', name='uq_chapter_audio_voice'),
    )
