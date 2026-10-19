import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.core.database import AsyncSessionLocal, engine, Base
from backend.model.verse import Verse
from sqlalchemy.future import select

# We are adding some dummy verses for test purposes
TEST_VERSES = [
    ("cuv", "gen", 1, 6, "神说：“诸水之间要有空气，将水分为上下。”"),
    ("cuv", "gen", 1, 7, "神就造出空气，将空气以下的水、空气以上的水分开了。事就这样成了。"),
    ("cuv", "gen", 1, 8, "神称空气为“天”。有晚上，有早晨，是第二日。"),
    ("cuv", "gen", 1, 9, "神说：“天下的水要聚在一处，使旱地露出来。”事就这样成了。"),
    ("cuv", "gen", 1, 10, "神称旱地为“地”，称水的聚处为“海”。神看着是好的。"),
    
    # english versions for en tab tests
    ("cuv_full", "gen", 1, 6, "神说：“诸水之间要有空气，将水分为上下。”"),
    ("cuv_full", "gen", 1, 7, "神就造出空气，将空气以下的水、空气以上的水分开了。事就这样成了。"),
    ("cuv_full", "gen", 1, 8, "神称空气为“天”。有晚上，有早晨，是第二日。"),
    ("cuv_full", "gen", 1, 9, "神说：“天下的水要聚在一处，使旱地露出来。”事就这样成了。"),
    ("cuv_full", "gen", 1, 10, "神称旱地为“地”，称水的聚处为“海”。神看着是好的。"),
]

async def seed_test_verses():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        for v_ver, v_book, v_ch, v_num, v_text in TEST_VERSES:
            result = await db.execute(
                select(Verse).filter(
                    Verse.version == v_ver,
                    Verse.book == v_book,
                    Verse.chapter == v_ch,
                    Verse.verse_num == v_num
                )
            )
            existing = result.scalar_one_or_none()
            if not existing:
                verse = Verse(
                    version=v_ver,
                    book=v_book,
                    chapter=v_ch,
                    verse_num=v_num,
                    text=v_text
                )
                db.add(verse)
                print(f"Adding test verse {v_ver} {v_book} {v_ch}:{v_num}...")
            else:
                print(f"updating existig verse {v_ver} {v_book} {v_ch}:{v_num}...")
                existing.text = v_text
        await db.commit()
    print("Test verse seeding finished.")

if __name__ == "__main__":
    asyncio.run(seed_test_verses())
