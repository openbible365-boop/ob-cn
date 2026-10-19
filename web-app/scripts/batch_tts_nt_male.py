"""
批量生成新约（男声·开朗学长）TTS 脚本
调用 /api/audio/tts?voice=male 接口，触发豆包合成并自动上传 S3 + 写入数据库

用法：
    backend/venv/bin/python scripts/batch_tts_nt_male.py
    backend/venv/bin/python scripts/batch_tts_nt_male.py --book mat --start 1 --end 10  # 分段跑
    backend/venv/bin/python scripts/batch_tts_nt_male.py --voice female  # 验证女声（默认就是）

说明：
    - 已在 S3 + 数据库缓存的章节自动跳过（cached=true）
    - 每章 AI 合成约 10-30 秒，1185 章全跑预计 8-12 小时（建议 overnight）
    - 支持断点续跑：中断后再执行同一命令，已完成的章节自动跳过
"""

import argparse
import time
import requests
import sys

# ── 配置 ─────────────────────────────────────────────────────────────────────
BASE_URL   = "http://localhost:8000/api/audio/tts"
DELAY_SEC  = 1.5    # 每章成功后的间隔（秒），避免连续占用 TTS 配额
TIMEOUT    = 120    # 单次请求超时（秒）

# 新约书卷顺序及总章数
NT_BOOKS = [
    ("mat", 28, "马太福音"),
    ("mrk", 16, "马可福音"),
    ("luk", 24, "路加福音"),
    ("jhn", 21, "约翰福音"),
    ("act", 28, "使徒行传"),
    ("rom", 16, "罗马书"),
    ("1co", 16, "哥林多前书"),
    ("2co", 13, "哥林多后书"),
    ("gal",  6, "加拉太书"),
    ("eph",  6, "以弗所书"),
    ("php",  4, "腓立比书"),
    ("col",  4, "歌罗西书"),
    ("1th",  5, "帖撒罗尼迦前书"),
    ("2th",  3, "帖撒罗尼迦后书"),
    ("1ti",  6, "提摩太前书"),
    ("2ti",  4, "提摩太后书"),
    ("tit",  3, "提多书"),
    ("phm",  1, "腓利门书"),
    ("heb", 13, "希伯来书"),
    ("jas",  5, "雅各书"),
    ("1pe",  5, "彼得前书"),
    ("2pe",  3, "彼得后书"),
    ("1jn",  5, "约翰一书"),
    ("2jn",  1, "约翰二书"),
    ("3jn",  1, "约翰三书"),
    ("jud",  1, "犹大书"),
    ("rev", 22, "启示录"),
]


def generate_chapter(book: str, chapter: int, voice: str) -> dict:
    url = f"{BASE_URL}?version=cuv&book={book}&chapter={chapter}&voice={voice}"
    resp = requests.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def run(target_book: str | None, start_ch: int, end_ch: int | None, voice: str):
    print(f"\n🎙  新约 TTS 批量生成  |  声音: {'知性女声' if voice == 'female' else '开朗学长'} ({voice})")
    print(f"{'─'*60}")

    total_success = total_skip = total_fail = 0

    for book_code, total_chapters, book_name in NT_BOOKS:
        # 若指定了特定书卷，只跑该书卷
        if target_book and book_code != target_book:
            continue

        ch_start = start_ch if (target_book and book_code == target_book) else 1
        ch_end = end_ch if (target_book and end_ch) else total_chapters

        print(f"\n📖  {book_name}（{book_code}）第 {ch_start}-{ch_end} 章")

        for ch in range(ch_start, ch_end + 1):
            prefix = f"  [{ch:>2}/{ch_end}] {book_name} 第{ch}章"
            try:
                data = generate_chapter(book_code, ch, voice)

                if data.get("cached"):
                    total_skip += 1
                    print(f"  ⏭  {prefix}  [已缓存跳过]")
                elif data.get("mock"):
                    total_fail += 1
                    print(f"  ⚠️  {prefix}  [模拟模式，跳过]")
                elif data.get("url"):
                    total_success += 1
                    ts_count = len(data.get("timestamps", []))
                    print(f"  ✅  {prefix}  [{data.get('voice_label','')}] {ts_count}节")
                    time.sleep(DELAY_SEC)
                else:
                    total_fail += 1
                    print(f"  ❌  {prefix}  [无 URL 返回]")

            except requests.exceptions.Timeout:
                total_fail += 1
                print(f"  ⚠️  {prefix}  [请求超时，跳过]")
                time.sleep(2)
            except Exception as e:
                total_fail += 1
                print(f"  ❌  {prefix}  [错误: {e}]")
                time.sleep(2)

    print(f"\n{'─'*60}")
    print(f"完成！✅ 新生成 {total_success}章  ⏭ 已缓存 {total_skip}章  ❌ 失败 {total_fail}章")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="批量生成新约男声 TTS")
    parser.add_argument("--book",  default=None, help="只跑指定书卷，如 mat / jhn（默认全部新约）")
    parser.add_argument("--start", type=int, default=1, help="起始章（配合 --book 使用）")
    parser.add_argument("--end",   type=int, default=None, help="结束章（配合 --book 使用）")
    parser.add_argument("--voice", default="male", choices=["male", "female"], help="声音类型（默认 male）")
    args = parser.parse_args()

    run(args.book, args.start, args.end, args.voice)
