import asyncio
from backend.core.database import AsyncSessionLocal
from backend.model.verse import Verse
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Verse.book).where(Verse.version == 'cuv').group_by(Verse.book))
        books = [r[0] for r in result.all()]
        print("Database Books:", sorted(books))

if __name__ == "__main__":
    asyncio.run(main())
