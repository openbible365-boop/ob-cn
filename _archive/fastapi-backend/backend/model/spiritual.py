from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.core.database import Base

class SpiritualStage(Base):
    """
    属灵阶段表 (Seeking, New Believer, Growing, Mature)
    """
    __tablename__ = "spiritual_stages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关联问题
    questions = relationship("SpiritualQuestion", back_populates="stage", cascade="all, delete-orphan")

class SpiritualQuestion(Base):
    """
    属灵阶段对应的问题
    """
    __tablename__ = "spiritual_questions"

    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, ForeignKey("spiritual_stages.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    category = Column(String(30), default="general", index=True) # "general" or "verse_drawer"
    description = Column(Text, nullable=True) # 问题的补充说明或引导
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关联阶段
    stage = relationship("SpiritualStage", back_populates="questions")
