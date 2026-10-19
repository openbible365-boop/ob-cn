from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.core.database import Base

class ReadingPlan(Base):
    __tablename__ = "reading_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, index=True, nullable=False) # e.g. mcheyne
    name_zh = Column(String(100), nullable=False)
    name_en = Column(String(100), nullable=True)
    desc_zh = Column(String(255), nullable=True)
    desc_en = Column(String(255), nullable=True)
    icon = Column(String(50), default="fa-book-open-reader")
    gradient = Column(String(100), default="linear-gradient(135deg, #6c5ce7, #a29bfe)")
    emoji = Column(String(10), default="📖")
    days = Column(Integer, default=365)
    schedule = Column(JSON, nullable=True) # e.g. [ [{"book": "gen", "chapter": 1}], ... ]
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UserReadingPlan(Base):
    __tablename__ = "user_reading_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(Integer, ForeignKey("reading_plans.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=False)
    current_day = Column(Integer, default=1)
    status = Column(String(20), default="active") # active, completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
    plan = relationship("ReadingPlan")
