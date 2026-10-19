import sys
import os
import asyncio
import argparse

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.service.tts import synthesize_chapter
from backend.repository.json_verse import json_verse_repo
from backend.core.database import AsyncSessionLocal

async def main():
    parser = argparse.ArgumentParser(description="测试合成单章 TTS 音频")
    parser.add_argument("--book", type=str, default="gen", help="测试的书卷，如 gen")
    parser.add_argument("--chapter", type=int, default=3, help="测试的章节，如 3")
    parser.add_argument("--force", action="store_true", help="强制重新合成，忽略缓存")
    args = parser.parse_args()

    book = args.book
    chapter = args.chapter

    print(f"🚀 开始测试单章音频合成: {book} 第 {chapter} 章 ...")

    # 加载经文数据
    verses = json_verse_repo._get_book_verses('cuv', book)
    if not verses:
        print(f"⚠️  未找到书卷 JSON 数据：{book}，退出。")
        return

    chapter_verses = [v for v in verses if v['chapter'] == chapter]
    if not chapter_verses:
        print(f"⚠️  未找到 {book} 第 {chapter} 章的经文，退出。")
        return

    verses_data = [{"verse": v['verse_num'], "text": v['text']} for v in chapter_verses]
    print(f"📚 共找到 {len(verses_data)} 节经文，开始合成 ...")

    try:
        async with AsyncSessionLocal() as db:
            result = await synthesize_chapter('cuv', book, chapter, verses_data, db=db, force=args.force)

        if result and result[0]:
            print(f"✅ 合成成功！音频地址: {result[0]}")
        else:
            print("✖️  合成失败（返回空）")
    except Exception as e:
        print(f"✖️  合成过程中出现异常: {e}")

if __name__ == "__main__":
    asyncio.run(main())
