import asyncio
import asyncpg
async def main():
    conn = await asyncpg.connect('postgresql://neondb_owner:npg_RohgbwWiJ63D@ep-bold-lake-ai2s8tpy-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require')
    try:
        await conn.execute("ALTER TABLE chapter_summaries ADD COLUMN version VARCHAR(20) DEFAULT 'cuv'")
        print("Added version column")
    except Exception as e:
        print("Version:", e)
    try:
        await conn.execute("ALTER TABLE chapter_summaries ADD COLUMN language VARCHAR(20) DEFAULT 'zh'")
        print("Added language column")
    except Exception as e:
        print("Language:", e)
    await conn.close()
asyncio.run(main())
