"""
批量合成旧约 TTS 音频并上传 S3 + 写入数据库

功能：
  - 遍历旧约所有书卷（cuv 版本下不在新约列表的书卷）
  - DB 已有记录的章节直接跳过（不再重新合成）
  - 合成成功后自动写入 chapter_audios 数据库
  - 每节间隔 1.2 秒防止触发频率限制

使用方式：
    python3 scripts/batch_tts_ot.py
    python3 scripts/batch_tts_ot.py --books gen,exo,lev   # 只处理指定书卷
"""

import sys
import os
import asyncio
import argparse

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.service.tts import NEW_TESTAMENT_BOOKS, synthesize_chapter
from backend.repository.json_verse import json_verse_repo

# 旧约书卷（按圣经顺序），排除新约
OLD_TESTAMENT_BOOKS = [
    "gen", "exo", "lev", "num", "deu",   # 摩西五经
    "jos", "jdg", "rut",                  # 历史书（前期）
    "1sa", "2sa", "1ki", "2ki",
    "1ch", "2ch", "ezr", "neh", "est",   # 历史书（后期）
    "job", "psa", "pro", "ecc", "sng",   # 诗歌智慧书
    "isa", "jer", "lam", "ezk", "dan",   # 大先知书
    "hos", "jol", "amo", "oba", "jon",   # 小先知书
    "mic", "nah", "hab", "zep", "hag",
    "zec", "mal",
]


async def _db_has_audio(db, book: str, chapter: int) -> bool:
    """检查 chapter_audios 表中是否已有该章节的记录"""
    from backend.repository import chapter_audio as audio_repo
    try:
        existing = await audio_repo.get_audio(db, version="cuv", book=book, chapter=chapter)
        return existing is not None
    except Exception:
        return False


async def main():
    parser = argparse.ArgumentParser(description="批量合成旧约 TTS 音频")
    parser.add_argument(
        "--books", type=str, default="",
        help="只处理指定书卷，逗号分隔，例如: --books gen,exo,psa"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="强制重新合成，忽略数据库或 S3 的已有缓存"
    )
    args = parser.parse_args()

    # 确定要处理的书卷列表
    if args.books:
        filter_books = [b.strip().lower() for b in args.books.split(",") if b.strip()]
        valid = [b for b in filter_books if b not in NEW_TESTAMENT_BOOKS]
        invalid = [b for b in filter_books if b in NEW_TESTAMENT_BOOKS]
        if invalid:
            print(f"⚠️  以下书卷属于新约，请使用 batch_tts_nt.py 处理: {invalid}")
        books_to_process = valid
        print(f"🔍 仅处理指定书卷: {books_to_process}")
    else:
        books_to_process = OLD_TESTAMENT_BOOKS

    print(f"🚀 开始批量合成旧约，共 {len(books_to_process)} 卷书 ...\n")

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
                if not args.force and await _db_has_audio(db, book, chapter):
                    print(f"  ⏭️  跳过（DB 已有记录）: {book}/{chapter}")
                    total_skip += 1
                    continue

            chapter_verses = [v for v in verses if v['chapter'] == chapter]
            verses_data = [{"verse": v['verse_num'], "text": v['text']} for v in chapter_verses]

            print(f"  🎙️  合成: {book}/{chapter}（{len(verses_data)} 节）...", end="", flush=True)

            try:
                async with AsyncSessionLocal() as db:
                    result = await synthesize_chapter(
                        'cuv', book, chapter, verses_data, db=db, force=args.force
                    )

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
