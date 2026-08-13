"""
批量生成章节速览脚本
用途：顺序调用 /api/ai/chapter-summary/{book}/{chapter}，触发 AI 生成并写库
      已有缓存的章节自动跳过（source=database），不会重复调用 AI

用法示例:
    # 单本书
    python3 scripts/batch_gen_summary.py --book gen
    python3 scripts/batch_gen_summary.py --book gen --chapters 50 --force

    # 多本书（按顺序依次生成）
    python3 scripts/batch_gen_summary.py --book gen exo lev num

    # 全部旧约
    python3 scripts/batch_gen_summary.py --all-ot

    # 全部新约
    python3 scripts/batch_gen_summary.py --all-nt

    # 全部圣经
    python3 scripts/batch_gen_summary.py --all

    # 强制覆盖
    python3 scripts/batch_gen_summary.py --book gen exo --force
"""

import argparse
import time
import requests
import sys

# ── 配置 ──────────────────────────────────────────────────────────────────────
BASE_URL   = "http://localhost:8000/api/ai/chapter-summary"
DELAY_SEC  = 2.0    # 每章之间的间隔（秒），避免频繁调用 AI 接口被限速
TIMEOUT    = 60     # 单次请求超时

# NOTE: 完整的圣经书卷列表，键为代码，值为 (中文名, 章数)
OT_BOOKS = [
    ("gen", "创世记",       50),
    ("exo", "出埃及记",     40),
    ("lev", "利未记",       27),
    ("num", "民数记",       36),
    ("deu", "申命记",       34),
    ("jos", "约书亚记",     24),
    ("jdg", "士师记",       21),
    ("rut", "路得记",        4),
    ("1sa", "撒母耳记上",   31),
    ("2sa", "撒母耳记下",   24),
    ("1ki", "列王纪上",     22),
    ("2ki", "列王纪下",     25),
    ("1ch", "历代志上",     29),
    ("2ch", "历代志下",     36),
    ("ezr", "以斯拉记",     10),
    ("neh", "尼希米记",     13),
    ("est", "以斯帖记",     10),
    ("job", "约伯记",       42),
    ("psa", "诗篇",        150),
    ("pro", "箴言",         31),
    ("ecc", "传道书",       12),
    ("sng", "雅歌",          8),
    ("isa", "以赛亚书",     66),
    ("jer", "耶利米书",     52),
    ("lam", "耶利米哀歌",    5),
    ("ezk", "以西结书",     48),
    ("dan", "但以理书",     12),
    ("hos", "何西阿书",     14),
    ("jol", "约珥书",        3),
    ("amo", "阿摩司书",      9),
    ("oba", "俄巴底亚书",    1),
    ("jon", "约拿书",        4),
    ("mic", "弥迦书",        7),
    ("nam", "那鸿书",        3),
    ("hab", "哈巴谷书",      3),
    ("zep", "西番雅书",      3),
    ("hag", "哈该书",        2),
    ("zec", "撒迦利亚书",   14),
    ("mal", "玛拉基书",      4),
]

NT_BOOKS = [
    ("mat", "马太福音",     28),
    ("mrk", "马可福音",     16),
    ("luk", "路加福音",     24),
    ("jhn", "约翰福音",     21),
    ("act", "使徒行传",     28),
    ("rom", "罗马书",       16),
    ("1co", "哥林多前书",   16),
    ("2co", "哥林多后书",   13),
    ("gal", "加拉太书",      6),
    ("eph", "以弗所书",      6),
    ("php", "腓立比书",      4),
    ("col", "歌罗西书",      4),
    ("1th", "帖撒罗尼迦前书", 5),
    ("2th", "帖撒罗尼迦后书", 3),
    ("1ti", "提摩太前书",    6),
    ("2ti", "提摩太后书",    4),
    ("tit", "提多书",        3),
    ("phm", "腓利门书",      1),
    ("heb", "希伯来书",     13),
    ("jas", "雅各书",        5),
    ("1pe", "彼得前书",      5),
    ("2pe", "彼得后书",      3),
    ("1jn", "约翰一书",      5),
    ("2jn", "约翰二书",      1),
    ("3jn", "约翰三书",      1),
    ("jud", "犹大书",        1),
    ("rev", "启示录",       22),
]

ALL_BOOKS = OT_BOOKS + NT_BOOKS

# 快速查找字典
BOOK_MAP = {code: (name, ch) for code, name, ch in ALL_BOOKS}


def generate_chapter(book: str, chapter: int, force: bool = False, version: str = "cuv") -> dict:
    """调用接口，返回响应数据"""
    url = f"{BASE_URL}/{book}/{chapter}?version={version}"
    if force:
        url += "&force=true"
    resp = requests.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def run(book: str, start: int, end: int, force: bool = False, version: str = "cuv"):
    book_name = BOOK_MAP.get(book, (book.upper(), end))[0]
    total = end - start + 1
    print(f"\n📖  开始批量生成「{book_name}」[{version.upper()}] 第 {start}～{end} 章速览")
    if force:
        print(f"    开启强制覆盖 (--force=true)！将替换现有缓存")
    print(f"    共 {total} 章，每章间隔 {DELAY_SEC}s\n{'─'*50}")

    success = skip = fail = 0

    for ch in range(start, end + 1):
        prefix = f"[{ch:>2}/{end}] {book_name} 第{ch}章"
        try:
            data = generate_chapter(book, ch, force=force, version=version)
            source = data.get("source", "?")
            tags   = data.get("theme_tags", [])
            chips  = len(data.get("explore_chips", []))
            answer = (data.get("answer") or "")[:40].replace("\n", " ")

            if source == "database":
                skip += 1
                print(f"  ⏭  {prefix}  [已缓存，跳过]")
            else:
                success += 1
                tag_str = " ".join(f"#{t}" for t in tags) if tags else "无标签"
                print(f"  ✅  {prefix}  [{source}]")
                print(f"      标签: {tag_str}  |  探索题: {chips}个")
                print(f"      速览: {answer}…")
                # 生成新内容后等待，避免限速
                time.sleep(DELAY_SEC)

        except requests.exceptions.Timeout:
            fail += 1
            print(f"  ⚠️  {prefix}  [超时，跳过]")
            time.sleep(1)
        except Exception as e:
            fail += 1
            print(f"  ❌  {prefix}  [错误: {e}]")
            time.sleep(1)

    print(f"\n{'─'*50}")
    print(f"完成！✅ 新生成 {success}章  ⏭ 已缓存 {skip}章  ❌ 失败 {fail}章")
    return success, skip, fail


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="批量生成章节 AI 速览")
    parser.add_argument("--book",     nargs="+",        help="书卷 code，支持多个，如 gen exo lev")
    parser.add_argument("--chapters", type=int,         help="总章数（单本书时有效，从第1章开始）")
    parser.add_argument("--start",    type=int, default=1,   help="起始章（单本书时有效，默认1）")
    parser.add_argument("--end",      type=int,         help="结束章（单本书时有效）")
    parser.add_argument("--version",  type=str, default="cuv", help="圣经版本（默认 cuv）")
    parser.add_argument("--force",    action="store_true", help="是否强制重新生成并覆盖现有缓存")
    parser.add_argument("--all-ot",   action="store_true", help="生成全部旧约 39 卷")
    parser.add_argument("--all-nt",   action="store_true", help="生成全部新约 27 卷")
    parser.add_argument("--all",      action="store_true", help="生成全部圣经 66 卷")
    args = parser.parse_args()

    # 确定要处理的书卷列表
    if args.all:
        books_to_run = [(code, name, ch) for code, name, ch in ALL_BOOKS]
    elif args.all_ot:
        books_to_run = [(code, name, ch) for code, name, ch in OT_BOOKS]
    elif args.all_nt:
        books_to_run = [(code, name, ch) for code, name, ch in NT_BOOKS]
    elif args.book:
        books_to_run = []
        for code in args.book:
            if code not in BOOK_MAP:
                print(f"⚠️  未知书卷代码：{code}，已跳过")
                continue
            name, total_ch = BOOK_MAP[code]
            books_to_run.append((code, name, total_ch))
    else:
        print("❗ 请指定 --book <代码> 或 --all / --all-ot / --all-nt")
        sys.exit(1)

    # 多本书时 --start / --end / --chapters 仅对单本有效
    is_single = len(books_to_run) == 1

    total_success = total_skip = total_fail = 0

    for i, (code, name, default_ch) in enumerate(books_to_run):
        if is_single:
            # 单本书支持自定义范围
            if args.end:
                end_ch = args.end
            elif args.chapters:
                end_ch = args.chapters
            else:
                end_ch = default_ch
            start_ch = args.start
        else:
            # 多本书时使用完整章数
            start_ch = 1
            end_ch = default_ch

        s, sk, f = run(code, start_ch, end_ch, force=args.force, version=args.version)
        total_success += s
        total_skip += sk
        total_fail += f

    if len(books_to_run) > 1:
        print(f"\n{'═'*50}")
        print(f"🎉  全部完成！共处理 {len(books_to_run)} 卷")
        print(f"    ✅ 新生成 {total_success}章  ⏭ 已缓存 {total_skip}章  ❌ 失败 {total_fail}章")
