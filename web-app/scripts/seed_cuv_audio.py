import asyncio
from backend.core.database import AsyncSessionLocal
from sqlalchemy.future import select
from backend.model.chapter_audio import ChapterAudio

# Book IDs map for the remote URL format
# https://cdsaws.s3-us-west-2.amazonaws.com/vou/bible/cn/cunpss/1-1.mp3
OT_BOOKS = [
    ('gen', 50), ('exo', 40), ('lev', 27), ('num', 36), ('deu', 34),
    ('jos', 24), ('jdg', 21), ('rut', 4), ('1sa', 31), ('2sa', 24),
    ('1ki', 22), ('2ki', 25), ('1ch', 29), ('2ch', 36), ('ezr', 10),
    ('neh', 13), ('est', 10), ('job', 42), ('psa', 150), ('pro', 31),
    ('ecc', 12), ('sng', 8), ('isa', 66), ('jer', 52), ('lam', 5),
    ('ezk', 48), ('dan', 12), ('hos', 14), ('jol', 3), ('amo', 9),
    ('oba', 1), ('jon', 4), ('mic', 7), ('nah', 3), ('hab', 3),
    ('zep', 3), ('hag', 2), ('zec', 14), ('mal', 4)
]

NT_BOOKS = [
    ('mat', 28), ('mrk', 16), ('luk', 24), ('jhn', 21), ('act', 28),
    ('rom', 16), ('1co', 16), ('2co', 13), ('gal', 6), ('eph', 6),
    ('php', 4), ('col', 4), ('1th', 5), ('2th', 3), ('1ti', 6),
    ('2ti', 4), ('tit', 3), ('phm', 1), ('heb', 13), ('jas', 5),
    ('1pe', 5), ('2pe', 3), ('1jn', 5), ('2jn', 1), ('3jn', 1),
    ('jud', 1), ('rev', 22)
]

ALL_BOOKS = OT_BOOKS + NT_BOOKS

async def seed_cuv_audio():
    print("Starting to seed CUV audio...")
    async with AsyncSessionLocal() as session:
        records_to_insert = []
        
        for idx, (book_abbr, max_chapter) in enumerate(ALL_BOOKS):
            book_id = idx + 1 # 1-based index (gen=1, rev=66)
            for chapter in range(1, max_chapter + 1):
                url = f"https://cdsaws.s3-us-west-2.amazonaws.com/vou/bible/cn/cunpss/{book_id}-{chapter}.mp3"
                records_to_insert.append({
                    "version": "cuv",
                    "book": book_abbr,
                    "chapter": chapter,
                    "audio_url": url,
                    "timestamps": None
                })
        
        print(f"Prepared {len(records_to_insert)} audio records for CUV.")
        
        # Dialect-agnostic insert/update
        # 1. Fetch existing CUV audio records
        result = await session.execute(
            select(ChapterAudio).where(ChapterAudio.version == "cuv")
        )
        existing_records = result.scalars().all()
        existing_map = {(r.book, r.chapter): r for r in existing_records}
        
        for idx, (book_abbr, max_chapter) in enumerate(ALL_BOOKS):
            book_id = idx + 1
            for chapter in range(1, max_chapter + 1):
                url = f"https://cdsaws.s3-us-west-2.amazonaws.com/vou/bible/cn/cunpss/{book_id}-{chapter}.mp3"
                
                if (book_abbr, chapter) in existing_map:
                    # Update
                    record = existing_map[(book_abbr, chapter)]
                    record.audio_url = url
                else:
                    # Insert
                    new_record = ChapterAudio(
                        version="cuv",
                        book=book_abbr,
                        chapter=chapter,
                        audio_url=url,
                        timestamps=None
                    )
                    session.add(new_record)
        
        await session.commit()
    print("Successfully seeded all audio records for CUV!")

if __name__ == "__main__":
    asyncio.run(seed_cuv_audio())
