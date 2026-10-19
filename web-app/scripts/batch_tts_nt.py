"""
批量合成新约 TTS 音频并上传 S3 + 写入数据库

功能：
  - 遍历新约所有书卷和章节
  - DB 已有记录的章节直接跳过（不再重新合成）
  - 合成成功后自动写入 chapter_audios 数据库
  - 每节间隔 1.2 秒防止触发频率限制

使用方式：
    python3 scripts/batch_tts_nt.py
    python3 scripts/batch_tts_nt.py --books jhn,jas,1jn,2jn,3jn   # 只处理指定书卷
"""

import sys
import os
import asyncio
import argparse

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.service.tts import NEW_TESTAMENT_BOOKS, synthesize_chapter
from backend.repository.json_verse import json_verse_repo


async def _db_has_audio(db, book: str, chapter: int) -> bool:
    """检查 chapter_audios 表中是否已有该章节的记录"""
    from backend.repository import chapter_audio as audio_repo
    try:
        existing = await audio_repo.get_audio(db, version="cuv", book=book, chapter=chapter)
        return existing is not None
    except Exception:
        return False


async def main():
    parser = argparse.ArgumentParser(description="批量合成新约 TTS 音频")
    parser.add_argument(
        "--books", type=str, default="",
        help="只处理指定书卷，逗号分隔，例如: --books jhn,jas,1jn,2jn,3jn"
    )
    args = parser.parse_args()

    # 确定要处理的书卷列表
    if args.books:
        filter_books = {b.strip().lower() for b in args.books.split(",") if b.strip()}
        books_to_process = sorted(filter_books & NEW_TESTAMENT_BOOKS)
        print(f"🔍 仅处理指定书卷: {books_to_process}")
    else:
        books_to_process = sorted(NEW_TESTAMENT_BOOKS)

    print(f"🚀 开始批量合成新约，共 {len(books_to_process)} 卷书 ...\n")

    total_ok = total_skip = total_fail = 0

    from backend.core.database import AsyncSessionLocal

    for book in books_to_process:
        # 加载经文数据
        verses = json_verse_repo._get_book_verses('cuv', book)
        if not verses:
            print(f"⚠️  未找到书卷 JSON 数据：{book}，跳过。")
            continue

        chapters = sorted(set(v['chapter'] for v in verses))
        print(f"\n📚 {book}（共 {len(chapters)} 章）")

        for chapter in chapters:
            # NOTE: 优先查 DB — 有记录就直接跳过，不重复合成
            async with AsyncSessionLocal() as db:
                if await _db_has_audio(db, book, chapter):
                    print(f"  ⏭️  跳过（DB 已有记录）: {book}/{chapter}")
                    total_skip += 1
                    continue

            chapter_verses = [v for v in verses if v['chapter'] == chapter]
            verses_data = [{"verse": v['verse_num'], "text": v['text']} for v in chapter_verses]

            print(f"  🎙️  合成: {book}/{chapter}（{len(verses_data)} 节）...", end="", flush=True)

            try:
                async with AsyncSessionLocal() as db:
                    result = await synthesize_chapter('cuv', book, chapter, verses_data, db=db)

                if result and result[0]:
                    print(f" ✅ {result[0]}")
                    total_ok += 1
                else:
                    print(" ✖️  失败（返回空）")
                    total_fail += 1
            except Exception as e:
                print(f" ✖️  异常: {e}")
                total_fail += 1

            # 防止触发豆包 TTS 频率限制
            await asyncio.sleep(1.2)

    print(f"\n{'─' * 50}")
    print(f"🎉 完成！✅ 成功: {total_ok}  ⏭️ 跳过: {total_skip}  ✖️ 失败: {total_fail}")


if __name__ == "__main__":
    asyncio.run(main())
