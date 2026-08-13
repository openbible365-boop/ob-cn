from sqlalchemy import Column, Integer, String, Text, UniqueConstraint, ForeignKey, DateTime
from sqlalchemy.sql import func
from backend.core.database import Base

class UserNote(Base):
    """
    用户个人灵修笔记 ORM 模型
    """
    __tablename__ = "user_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    verse_ref = Column(String(100), nullable=False, index=True)
    content = Column(Text, nullable=False)  # JSON 序列化后的笔记详情
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'verse_ref', name='uq_user_note_ref'),
    )
