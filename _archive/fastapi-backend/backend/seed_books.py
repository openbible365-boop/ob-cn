import asyncio
import sys
import os

# Add the current directory to sys.path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.core.database import AsyncSessionLocal, engine, Base
from backend.model.book import Book
from sqlalchemy.future import select

BIBLE_BOOKS = [
    (1, "gen", "创世记", "创", 50, 0),
    (2, "exo", "出埃及记", "出", 40, 0),
    (3, "lev", "利未记", "利", 27, 0),
    (4, "num", "民数记", "民", 36, 0),
    (5, "deu", "申命记", "申", 34, 0),
    (6, "jos", "约书亚记", "约", 24, 0),
    (7, "jdg", "士师记", "士", 21, 0),
    (8, "rut", "路得记", "路", 4, 0),
    (9, "1sa", "撒母耳记上", "撒上", 31, 0),
    (10, "2sa", "撒母耳记下", "撒下", 24, 0),
    (11, "1ki", "列王纪上", "王上", 22, 0),
    (12, "2ki", "列王纪下", "王下", 25, 0),
    (13, "1ch", "历代志上", "代上", 29, 0),
    (14, "2ch", "历代志下", "代下", 36, 0),
    (15, "ezr", "以斯拉记", "拉", 10, 0),
    (16, "neh", "尼希米记", "尼", 13, 0),
    (17, "est", "以斯帖记", "斯", 10, 0),
    (18, "job", "约伯记", "伯", 42, 0),
    (19, "psa", "诗篇", "诗", 150, 0),
    (20, "pro", "箴言", "箴", 31, 0),
    (21, "ecc", "传道书", "传", 12, 0),
    (22, "sng", "雅歌", "歌", 8, 0),
    (23, "isa", "以赛亚书", "赛", 66, 0),
    (24, "jer", "耶利米书", "耶", 52, 0),
    (25, "lam", "耶利米哀歌", "哀", 5, 0),
    (26, "ezek", "以西结书", "结", 48, 0),
    (27, "dan", "当以理书", "但", 12, 0),
    (28, "hos", "何西阿书", "何", 14, 0),
    (29, "joe", "约珥书", "约", 3, 0),
    (30, "amo", "阿摩司书", "阿", 9, 0),
    (31, "oba", "俄巴底亚书", "俄", 1, 0),
    (32, "jon", "约拿书", "拿", 4, 0),
    (33, "mic", "弥迦书", "弥", 7, 0),
    (34, "nah", "那鸿书", "那", 3, 0),
    (35, "hab", "哈巴谷书", "哈", 3, 0),
    (36, "zep", "西番雅书", "番", 3, 0),
    (37, "hag", "哈该书", "该", 2, 0),
    (38, "zec", "撒迦利亚书", "撒", 14, 0),
    (39, "mal", "玛拉基书", "玛", 4, 0),
    (40, "mat", "马太福音", "太", 28, 1),
    (41, "mrk", "马可福音", "马", 16, 1),
    (42, "luk", "路加福音", "路", 24, 1),
    (43, "jhn", "约翰福音", "约", 21, 1),
    (44, "act", "使徒行传", "徒", 28, 1),
    (45, "rom", "罗马书", "罗", 16, 1),
    (46, "1co", "哥林多前书", "林前", 16, 1),
    (47, "2co", "哥林多后书", "林后", 13, 1),
    (48, "gal", "加拉太书", "加", 6, 1),
    (49, "eph", "以弗所书", "以", 6, 1),
    (50, "php", "腓立比书", "腓", 4, 1),
    (51, "col", "歌罗西书", "歌", 4, 1),
    (52, "1th", "帖撒罗尼迦前书", "帖前", 5, 1),
    (53, "2th", "帖撒罗尼迦后书", "帖后", 3, 1),
    (54, "1ti", "提摩太前书", "提前", 6, 1),
    (55, "2ti", "提摩太后书", "提后", 4, 1),
    (56, "tit", "提多书", "多", 3, 1),
    (57, "phm", "腓利门书", "门", 1, 1),
    (58, "heb", "希伯来书", "希", 13, 1),
    (59, "jas", "雅各书", "雅", 5, 1),
    (60, "1pe", "彼得前书", "彼前", 5, 1),
    (61, "2pe", "彼得后书", "彼后", 3, 1),
    (62, "1jn", "约翰一书", "约一", 5, 1),
    (63, "2jn", "约翰二书", "约二", 1, 1),
    (64, "3jn", "约翰三书", "约三", 1, 1),
    (65, "jud", "犹大书", "犹", 1, 1),
    (66, "rev", "启示录", "启", 22, 1)
]

async def seed_books():
    # 确保表已创建
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        for sn, code, full, short, chapters, no in BIBLE_BOOKS:
            v_tag = "cuv"
            # Check if exists for this version
            result = await db.execute(select(Book).filter(Book.code == code, Book.version == v_tag))
            existing = result.scalar_one_or_none()
            if not existing:
                book = Book(
                    version=v_tag,
                    sn=sn,
                    code=code,
                    full_name=full,
                    short_name=short,
                    chapter_count=chapters,
                    new_old=no
                )
                db.add(book)
                print(f"Adding {v_tag}:{full}...")
        await db.commit()
    print("Seeding finished.")

if __name__ == "__main__":
    asyncio.run(seed_books())
