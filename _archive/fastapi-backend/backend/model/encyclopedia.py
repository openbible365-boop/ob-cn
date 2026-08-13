from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, func
from backend.core.database import Base


class EncyclopediaEntry(Base):
    """
    百科条目：承载「词典 / 文章 / 灵修」三类长文内容。
    影音不入此表，直接复用 media_items（/api/media）。
    标题/摘要/正文均为 zh/en/ko 三语，随前端语言切换显示。
    """
    __tablename__ = 'encyclopedia_entries'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, index=True)
    # 'dictionary' | 'article' | 'devotional'
    entry_type = Column(String(20), nullable=False, index=True)
    # 自定义分类/标签，如「神学词汇」「灵修小品」
    category = Column(String(100), nullable=True)
    # 词典首字母索引（A-Z / #）；其它类型可空
    index_letter = Column(String(8), nullable=True, index=True)
    # 封面：CSS gradient / 图片 URL / Font Awesome 类名（文章、灵修用）
    cover_style = Column(String(255), nullable=True)
    # 文章 / 灵修作者署名
    author = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # 三语标题
    title_zh = Column(String(255), nullable=True)
    title_en = Column(String(255), nullable=True)
    title_ko = Column(String(255), nullable=True)
    # 三语摘要（列表卡片用）
    summary_zh = Column(Text, nullable=True)
    summary_en = Column(Text, nullable=True)
    summary_ko = Column(Text, nullable=True)
    # 三语正文（词典=释义，文章/灵修=长文）
    content_zh = Column(Text, nullable=True)
    content_en = Column(Text, nullable=True)
    content_ko = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
