from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.core.database import Base

class UserActionLog(Base):
    """
    用户常规业务行为流水表，如登录、经文阅读、音频播放记录
    """
    __tablename__ = "user_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # login, read, audio_play, audio_complete
    action_type = Column(String(50), nullable=False, index=True)
    
    # 相关阅读/收听书卷（例如 gen、mat），针对 login 时可为空
    book = Column(String(10), nullable=True, index=True)
    chapter = Column(Integer, nullable=True)
    
    # 经文版本
    version_used = Column(String(20), nullable=True)

    # 针对 audio 的播放时长与语速
    duration = Column(Integer, nullable=True) 
    playback_rate = Column(Float, nullable=True)

    # 针对登录时的基础追踪
    ip_address = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    user = relationship("User", backref="action_logs")
