from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.model.ai import VerseAnalysis, AIQuestionCache, ChapterSummary


async def get_analysis_by_ref(db: AsyncSession, verse_ref: str) -> Optional[VerseAnalysis]:
    """根据经文引用获取缓存的AI解析"""
    result = await db.execute(select(VerseAnalysis).where(VerseAnalysis.verse_ref == verse_ref))
    return result.scalars().first()


async def create_analysis(db: AsyncSession, verse_ref: str, content: str) -> VerseAnalysis:
    """保存AI解析到数据库缓存"""
    db_analysis = VerseAnalysis(
        verse_ref=verse_ref,
        content=content
    )
    db.add(db_analysis)
    await db.commit()
    await db.refresh(db_analysis)
    return db_analysis


async def get_question_cache(db: AsyncSession, question_hash: str) -> Optional[AIQuestionCache]:
    """按问题 SHA256 哈希查找历史缓存答案"""
    result = await db.execute(
        select(AIQuestionCache).where(AIQuestionCache.question_hash == question_hash)
    )
    return result.scalars().first()


async def create_question_cache(
    db: AsyncSession, question_hash: str, question: str, answer: str
) -> AIQuestionCache:
    """将新问答存入缓存表"""
    cache = AIQuestionCache(
        question_hash=question_hash,
        question=question,
        answer=answer
    )
    db.add(cache)
    await db.commit()
    await db.refresh(cache)
    return cache

async def get_chapter_summary(db: AsyncSession, book_code: str, chapter: int, version: str = "cuv") -> Optional[ChapterSummary]:
    """获取指定章节的速览"""
    result = await db.execute(
        select(ChapterSummary).where(
            ChapterSummary.book_code == book_code,
            ChapterSummary.chapter == chapter,
            ChapterSummary.version == version
        )
    )
    return result.scalars().first()

async def create_chapter_summary(
    db: AsyncSession, book_code: str, chapter: int, content: str,
    explore_questions: str = None, theme_tags: str = None,
    version: str = "cuv", language: str = "zh"
) -> ChapterSummary:
    """插入新的章节速览"""
    summary = ChapterSummary(
        book_code=book_code,
        chapter=chapter,
        content=content,
        explore_questions=explore_questions,
        theme_tags=theme_tags,
        version=version,
        language=language
    )
    db.add(summary)
    await db.commit()
    await db.refresh(summary)
    return summary


async def upsert_chapter_summary(
    db: AsyncSession, book_code: str, chapter: int, content: str,
    explore_questions: str = None, theme_tags: str = None,
    version: str = "cuv", language: str = "zh"
) -> ChapterSummary:
    """若存在则更新，否则新建章节速览（用于 force 强制覆盖场景）"""
    existing = await get_chapter_summary(db, book_code, chapter, version)
    if existing:
        # NOTE: 直接修改对象属性再 commit，避免删除+插入带来的竞态风险
        existing.content = content
        existing.explore_questions = explore_questions
        existing.theme_tags = theme_tags
        existing.language = language
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        return await create_chapter_summary(db, book_code, chapter, content, explore_questions, theme_tags, version, language)
