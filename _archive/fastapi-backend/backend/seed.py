import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from backend.core.database import AsyncSessionLocal, engine, Base
from backend.model.user import User
from backend.model.book import Book
from backend.model.version import Version
from backend.model.verse import Verse
from backend.model.chapter_audio import ChapterAudio
from backend.model.study_note import StudyNote
from backend.service.auth import get_password_hash

async def seed_admin():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if admin exists
        from sqlalchemy.future import select
        result = await session.execute(select(User).where(User.email == "admin@openbible.com"))
        user = result.scalars().first()
        if not user:
            print("Creating default admin user: admin@openbible.com / admin123")
            admin_user = User(
                email="admin@openbible.com",
                username="Admin",
                role="admin",
                hashed_password=get_password_hash("admin123")
            )
            session.add(admin_user)
            await session.commit()
            print("Admin user created.")
        else:
            print("Admin already exists.")

if __name__ == "__main__":
    asyncio.run(seed_admin())
