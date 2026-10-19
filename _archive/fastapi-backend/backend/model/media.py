from sqlalchemy import Column, String, Text, DateTime, func, Enum
from sqlalchemy.schema import PrimaryKeyConstraint
from backend.core.database import Base
from datetime import datetime
import enum

class MediaType(enum.Enum):
    VIDEO = 'video'
    AUDIO = 'audio'

class MediaItem(Base):
    __tablename__ = 'media_items'
    __table_args__ = {'extend_existing': True}
    
    id = Column(String(36), primary_key=True, index=True) # Usually a short id like v1, a1, or uuid
    media_type = Column(String(20), nullable=False, index=True) # 'video' or 'audio'
    title = Column(String(255), nullable=False)
    series = Column(String(255), nullable=True) # Used by video mostly
    category = Column(String(100), nullable=False)
    duration = Column(String(50), nullable=True) # e.g. "45:32"
    teacher = Column(String(255), nullable=True) # Also maps to speaker for audio
    description = Column(Text, nullable=True)
    cover_style = Column(String(255), nullable=True) # e.g. "linear-gradient(...)" or "fa-sun"
    url = Column(String(500), nullable=True) # Can store actual S3 or youtube URLs later
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
