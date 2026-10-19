"""
批量预生成章节标签解读脚本
用途：遍历所有已生成速览的章节，取出每章的 theme_tags，
      逐一调用 /api/ai/eval/tag-explain 预热数据库缓存。
      已缓存的标签自动跳过（source=database），不重复调用 AI。

用法：
    # 全部圣经标签
    python3 scripts/batch_gen_tag_explain.py

    # 只生成旧约
    python3 scripts/batch_gen_tag_explain.py --testament ot

    # 只生成新约
    python3 scripts/batch_gen_tag_explain.py --testament nt

    # 只生成某几卷
    python3 scripts/batch_gen_tag_explain.py --book gen exo lev

    # 强制覆盖已有缓存
    python3 scripts/batch_gen_tag_explain.py --book gen --force
"""

import argparse
import time
import requests
import sys
import json

# ── 配置 ──────────────────────────────────────────────────────────────────────
BASE_URL      = "http://localhost:8000"
MODEL         = "qwen-plus"   # 用于生成标签解读的模型
DELAY_SEC     = 2.5           # 每次 AI 调用后等待秒数（避免限速）
TIMEOUT       = 90            # 单次请求超时秒数

# ── 完整书卷列表 ───────────────────────────────────────────────────────────────
OT_BOOKS = [
    ("gen", "创世记",         50), ("exo", "出埃及记",     40),
    ("lev", "利未记",         27), ("num", "民数记",        36),
    ("deu", "申命记",         34), ("jos", "约书亚记",      24),
    ("jdg", "士师记",         21), ("rut", "路得记",         4),
    ("1sa", "撒母耳记上",     31), ("2sa", "撒母耳记下",    24),
    ("1ki", "列王纪上",       22), ("2ki", "列王纪下",      25),
    ("1ch", "历代志上",       29), ("2ch", "历代志下",      36),
    ("ezr", "以斯拉记",       10), ("neh", "尼希米记",      13),
    ("est", "以斯帖记",       10), ("job", "约伯记",        42),
    ("psa", "诗篇",          150), ("pro", "箴言",          31),
    ("ecc", "传道书",         12), ("sng", "雅歌",           8),
    ("isa", "以赛亚书",       66), ("jer", "耶利米书",      52),
    ("lam", "耶利米哀歌",      5), ("ezk", "以西结书",      48),
    ("dan", "但以理书",       12), ("hos", "何西阿书",      14),
    ("jol", "约珥书",          3), ("amo", "阿摩司书",       9),
    ("oba", "俄巴底亚书",      1), ("jon", "约拿书",         4),
    ("mic", "弥迦书",          7), ("nam", "那鸿书",         3),
    ("hab", "哈巴谷书",        3), ("zep", "西番雅书",       3),
    ("hag", "哈该书",          2), ("zec", "撒迦利亚书",    14),
    ("mal", "玛拉基书",        4),
]

NT_BOOKS = [
    ("mat", "马太福音",       28), ("mrk", "马可福音",      16),
    ("luk", "路加福音",       24), ("jhn", "约翰福音",      21),
    ("act", "使徒行传",       28), ("rom", "罗马书",        16),
    ("1co", "哥林多前书",     16), ("2co", "哥林多后书",    13),
    ("gal", "加拉太书",        6), ("eph", "以弗所书",       6),
    ("php", "腓立比书",        4), ("col", "歌罗西书",       4),
    ("1th", "帖撒罗尼迦前书",  5), ("2th", "帖撒罗尼迦后书", 3),
    ("1ti", "提摩太前书",      6), ("2ti", "提摩太后书",     4),
    ("tit", "提多书",          3), ("phm", "腓利门书",       1),
    ("heb", "希伯来书",       13), ("jas", "雅各书",         5),
    ("1pe", "彼得前书",        5), ("2pe", "彼得后书",       3),
    ("1jn", "约翰一书",        5), ("2jn", "约翰二书",       1),
    ("3jn", "约翰三书",        1), ("jud", "犹大书",         1),
    ("rev", "启示录",         22),
]

ALL_BOOKS = OT_BOOKS + NT_BOOKS
BOOK_MAP  = {code: (name, ch) for code, name, ch in ALL_BOOKS}


def get_chapter_tags(book_code: str, chapter: int, version: str = "cuv") -> list[str]:
    """获取指定章节已生成的 theme_tags；若还未生成速览则返回空列表"""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/ai/chapter-summary/{book_code}/{chapter}?version={version}",
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        # 只有来自数据库或已生成的才有标签
        tags = data.get("theme_tags", [])
        return tags if isinstance(tags, list) else []
    except Exception:
        return []


def call_tag_explain(book_code: str, book_name: str, chapter: int,
                     tag: str, force: bool = False, version: str = "cuv", model: str = MODEL) -> dict:
    """调用 tag-explain 接口，返回结果字典"""
    # NOTE: force 模式下先删除现有缓存再重建需在接口层实现；
    #       目前只要 source!=database 就算新生成
    payload = {
        "book_code": book_code,
        "book_name": book_name,
        "chapter":   chapter,
        "tag":       tag,
        "model":     model,
        "version":   version,
        "force":     force,
    }
    resp = requests.post(
        f"{BASE_URL}/api/ai/eval/tag-explain",
        json=payload,
        timeout=TIMEOUT
    )
    resp.raise_for_status()
    return resp.json()


def run_book(book_code: str, book_name: str, total_chapters: int, force: bool = False, version: str = "cuv", model: str = MODEL, start_ch: int = 1, end_ch: int = None):
    end_ch = end_ch or total_chapters
    print(f"\n📖  开始预生成「{book_name}」[{version.upper()}] 标签解读（第 {start_ch}～{end_ch} 章）")
    print(f"    模型：{model}  |  每次间隔 {DELAY_SEC}s\n{'─'*54}")

    total_tags = new_tags = cached_tags = fail_tags = no_tags = 0

    for ch in range(start_ch, end_ch + 1):
        tags = get_chapter_tags(book_code, ch, version=version)

        if not tags:
            no_tags += 1
            print(f"  ─  [{ch:>3}/{total_chapters}] 第{ch}章  [无标签，跳过]")
            continue

        total_tags += len(tags)
        print(f"  📌  [{ch:>3}/{total_chapters}] {book_name} 第{ch}章  ({len(tags)}个标签: {' '.join(tags)})")

        for tag in tags:
            try:
                data = call_tag_explain(book_code, book_name, ch, tag, force=force, version=version, model=model)
                source = data.get("source", "api")

                if source == "database":
                    cached_tags += 1
                    print(f"      ⏭  #{tag}  [已缓存]")
                else:
                    new_tags += 1
                    preview = (data.get("answer") or "")[:35].replace("\n", " ")
                    print(f"      ✅  #{tag}  →  {preview}…")
                    time.sleep(DELAY_SEC)

            except Exception as e:
                fail_tags += 1
                print(f"      ❌  #{tag}  [错误: {e}]")
                time.sleep(1)

    print(f"\n{'─'*54}")
    print(f"「{book_name}」完成！✅ 新生成 {new_tags}  ⏭ 已缓存 {cached_tags}  ─ 无标签章 {no_tags}  ❌ 失败 {fail_tags}")
    return new_tags, cached_tags, fail_tags


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="批量预生成章节标签解读并缓存到数据库")
    parser.add_argument("--book",      nargs="+", help="书卷 code，支持多个，如 gen exo")
    parser.add_argument("--testament", choices=["ot", "nt"], help="ot=旧约  nt=新约")
    parser.add_argument("--version",   type=str, default="cuv", help="圣经版本（默认 cuv）")
    parser.add_argument("--force",     action="store_true", help="是否强制覆盖已有缓存")
    parser.add_argument("--start",     type=int, help="起始章（仅在只有一个书卷时有效）")
    parser.add_argument("--end",       type=int, help="结束章（仅在只有一个书卷时有效）")
    args = parser.parse_args()

    if args.book:
        books_to_run = []
        for code in args.book:
            if code not in BOOK_MAP:
                print(f"⚠️  未知书卷代码：{code}，已跳过")
                continue
            name, ch = BOOK_MAP[code]
            books_to_run.append((code, name, ch))
    elif args.testament == "ot":
        books_to_run = OT_BOOKS
    elif args.testament == "nt":
        books_to_run = NT_BOOKS
    else:
        books_to_run = ALL_BOOKS

    if not books_to_run:
        print("❗ 没有找到要处理的书卷")
        sys.exit(1)

    target_model = MODEL

    print(f"🚀  开始批量预生成标签解读")
    print(f"    共 {len(books_to_run)} 卷  |  模型：{target_model}  |  版本：{args.version}  |  force={args.force}")

    is_single_book = len(books_to_run) == 1
    grand_new = grand_cached = grand_fail = 0
    for code, name, chapters in books_to_run:
        start_ch = args.start if (is_single_book and args.start) else 1
        end_ch = args.end if (is_single_book and args.end) else chapters
        n, c, f = run_book(code, name, chapters, force=args.force, version=args.version, model=target_model, start_ch=start_ch, end_ch=end_ch)
        grand_new    += n
        grand_cached += c
        grand_fail   += f

    print(f"\n{'═'*54}")
    print(f"🎉  全部完成！")
    print(f"    ✅ 新生成 {grand_new}  ⏭ 已缓存 {grand_cached}  ❌ 失败 {grand_fail}")
