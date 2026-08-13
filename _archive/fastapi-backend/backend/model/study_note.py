from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from backend.core.database import Base

class StudyNote(Base):
    """
    Study Bible (精读本) Notes Model
    Stores commentaries/explanations for specific verses to be used by AI analysis.
    """
    __tablename__ = "study_notes"

    id = Column(Integer, primary_key=True, index=True)
    verse_ref = Column(String(50), index=True, nullable=False) # e.g., 'gen-1-1'
    content = Column(Text, nullable=False)                    # The commentary content

    # Ensure uniqueness per verse reference
    __table_args__ = (
        UniqueConstraint('verse_ref', name='uq_study_note_verse'),
    )
