import asyncio
import sys
import os

# Add the current directory to sys.path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.core.database import AsyncSessionLocal, engine, Base
from backend.model.version import Version
from sqlalchemy.future import select

BIBLE_VERSIONS = [
    ("cuv", "和合本", "zh", "和合本 (Chinese Union Version) 是最普及的中文圣经译本。"),
    ("kjv", "King James Version", "en", "The King James Version (KJV) is an English translation of the Christian Bible for the Church of England."),
    ("niv", "New International Version", "en", "The New International Version (NIV) is an English translation of the Bible.")
]

async def seed_versions():
    # 确保表已创建
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as db:
        for code, name, lang, desc in BIBLE_VERSIONS:
            # Check if exists
            result = await db.execute(select(Version).filter(Version.code == code))
            existing = result.scalar_one_or_none()
            if not existing:
                version = Version(
                    code=code,
                    name=name,
                    language=lang,
                    description=desc
                )
                db.add(version)
                print(f"Adding version: {name} ({code})...")
        await db.commit()
    print("Seeding versions finished.")

if __name__ == "__main__":
    asyncio.run(seed_versions())
