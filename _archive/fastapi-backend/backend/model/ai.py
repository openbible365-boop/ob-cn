from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from backend.core.database import Base

class VerseAnalysis(Base):
    """
    经文AI解析缓存表
    """
    __tablename__ = "verse_analyses"

    id = Column(Integer, primary_key=True, index=True)
    verse_ref = Column(String(50), unique=True, index=True, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

class AILog(Base):
    """
    AI 助手交互日志明细表
    """
    __tablename__ = "ai_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # 比如: "经文解析"、"自由问答"
    interaction_type = Column(String(50), nullable=True, index=True)
    
    # 获取用户提问的前80个字做索引/摘要，超出则不保存全文
    prompt_summary = Column(String(200), nullable=True)
    
    # 可能会携带用户正在阅读的关联经文范围 "gen 1:1-5"
    reference = Column(String(50), nullable=True)

    model_name = Column(String(50), nullable=True)
    
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    
    # 请求到响应返回的总耗时毫秒
    latency_ms = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", backref="ai_logs")


class AIQuestionCache(Base):
    """
    AI 问答缓存表 — 避免重复调用 n1n.ai 接口
    key: question_hash（问题文本的 SHA256 前 32 字符）
    """
    __tablename__ = "ai_question_caches"

    id = Column(Integer, primary_key=True, index=True)
    # NOTE: 用问题 SHA256 做唯一索引，避免全文匹配开销
    question_hash = Column(String(64), unique=True, index=True, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChapterSummary(Base):
    """
    本章速览缓存表 — 持久化大模型生成的特定章节概览
    """
    __tablename__ = "chapter_summaries"

    id = Column(Integer, primary_key=True, index=True)
    book_code = Column(String(20), index=True, nullable=False) # e.g. 'gen'
    chapter = Column(Integer, index=True, nullable=False)      # e.g. 1
    content = Column(Text, nullable=False)
    explore_questions = Column(Text, nullable=True) # 用 JSON 字符串存储 3 个探索问题
    theme_tags = Column(Text, nullable=True)
    version = Column(String(20), index=True, default="cuv")
    language = Column(String(20), index=True, default="zh")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

