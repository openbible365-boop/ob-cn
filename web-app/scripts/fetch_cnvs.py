"""
新译本（cnvs）圣经数据爬取脚本
来源：http://waw-js.com/html/bible/cn/cnvs/{book_num}-{chapter}.html

会将抓取结果存到 data/zh/cnvs/{book_code}.json
格式与 data/zh/cuv/*.json 完全相同：
{
  "book": "gen",
  "version": "cnvs",
  "chapters": [
    {"chapter": 1, "verses": [{"verse": 1, "text": "..."}]},
    ...
  ]
}

用法:
    python3 scripts/fetch_cnvs.py              # 全部 66 卷
    python3 scripts/fetch_cnvs.py --book gen   # 只抓单卷
    python3 scripts/fetch_cnvs.py --start 40   # 从第 40 本书开始
"""

import argparse
import html
import json
import os
import re
import sys
import time

import requests

# ── 配置 ──────────────────────────────────────────────────────────────────────
BASE_URL    = "http://waw-js.com/html/bible/cn/cnvs/{num}-{ch}.html"
OUTPUT_DIR  = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "zh", "cnvs")
DELAY_SEC   = 0.6   # 每次请求间隔（礼貌爬取）
TIMEOUT     = 15

# ── 完整书卷顺序表（序号 = waw-js URL 中的 book_num）────────────────────────
BOOKS = [
    ( 1, "gen", "创世记",         50),
    ( 2, "exo", "出埃及记",       40),
    ( 3, "lev", "利未记",         27),
    ( 4, "num", "民数记",         36),
    ( 5, "deu", "申命记",         34),
    ( 6, "jos", "约书亚记",       24),
    ( 7, "jdg", "士师记",         21),
    ( 8, "rut", "路得记",          4),
    ( 9, "1sa", "撒母耳记上",     31),
    (10, "2sa", "撒母耳记下",     24),
    (11, "1ki", "列王纪上",       22),
    (12, "2ki", "列王纪下",       25),
    (13, "1ch", "历代志上",       29),
    (14, "2ch", "历代志下",       36),
    (15, "ezr", "以斯拉记",       10),
    (16, "neh", "尼希米记",       13),
    (17, "est", "以斯帖记",       10),
    (18, "job", "约伯记",         42),
    (19, "psa", "诗篇",          150),
    (20, "pro", "箴言",           31),
    (21, "ecc", "传道书",         12),
    (22, "sng", "雅歌",            8),
    (23, "isa", "以赛亚书",       66),
    (24, "jer", "耶利米书",       52),
    (25, "lam", "耶利米哀歌",      5),
    (26, "ezk", "以西结书",       48),
    (27, "dan", "但以理书",       12),
    (28, "hos", "何西阿书",       14),
    (29, "jol", "约珥书",          3),
    (30, "amo", "阿摩司书",        9),
    (31, "oba", "俄巴底亚书",      1),
    (32, "jon", "约拿书",          4),
    (33, "mic", "弥迦书",          7),
    (34, "nam", "那鸿书",          3),
    (35, "hab", "哈巴谷书",        3),
    (36, "zep", "西番雅书",        3),
    (37, "hag", "哈该书",          2),
    (38, "zec", "撒迦利亚书",     14),
    (39, "mal", "玛拉基书",        4),
    (40, "mat", "马太福音",       28),
    (41, "mrk", "马可福音",       16),
    (42, "luk", "路加福音",       24),
    (43, "jhn", "约翰福音",       21),
    (44, "act", "使徒行传",       28),
    (45, "rom", "罗马书",         16),
    (46, "1co", "哥林多前书",     16),
    (47, "2co", "哥林多后书",     13),
    (48, "gal", "加拉太书",        6),
    (49, "eph", "以弗所书",        6),
    (50, "php", "腓立比书",        4),
    (51, "col", "歌罗西书",        4),
    (52, "1th", "帖撒罗尼迦前书",  5),
    (53, "2th", "帖撒罗尼迦后书",  3),
    (54, "1ti", "提摩太前书",      6),
    (55, "2ti", "提摩太后书",      4),
    (56, "tit", "提多书",          3),
    (57, "phm", "腓利门书",        1),
    (58, "heb", "希伯来书",       13),
    (59, "jas", "雅各书",          5),
    (60, "1pe", "彼得前书",        5),
    (61, "2pe", "彼得后书",        3),
    (62, "1jn", "约翰一书",        5),
    (63, "2jn", "约翰二书",        1),
    (64, "3jn", "约翰三书",        1),
    (65, "jud", "犹大书",          1),
    (66, "rev", "启示录",         22),
]

BOOK_MAP = {code: (num, name, chs) for num, code, name, chs in BOOKS}


def parse_chapter(html_text: str) -> dict[int, str]:
    """
    从章节 HTML 中提取 {verse_num: text} 字典。
    同一节号可能分散在多个 <span class="verse"> 里（段落换行），需合并。
    """
    # 提取所有 verse span：data-usfm="BOOK.CH.V" ... <span class="content">text</span>
    verse_pattern = re.compile(
        r'<span[^>]+data-usfm="[A-Z0-9]+\.\d+\.(\d+)"[^>]*>'   # 捕获节号
        r'(?:.*?<span class="content">(.*?)</span>)',            # 捕获 content
        re.DOTALL
    )

    # 多个 content 可能属于同一节（同节号多段）— 用 OrderedDict 按顺序合并
    verses: dict[int, list[str]] = {}
    for m in verse_pattern.finditer(html_text):
        v_num = int(m.group(1))
        content = html.unescape(m.group(2)).strip()
        # 移除内部残留的 HTML 标签（如 <br>）
        content = re.sub(r'<[^>]+>', '', content).strip()
        if content:
            verses.setdefault(v_num, []).append(content)

    # 合并同节文本（用空格连接）
    return {v: ' '.join(parts) for v, parts in verses.items()}


def fetch_book(book_num: int, book_code: str, book_name: str, total_chapters: int) -> bool:
    """抓取一整本书，返回是否成功"""
    print(f"\n📖  [{book_num:02d}/66] {book_name}（{total_chapters} 章）")

    out_path = os.path.join(OUTPUT_DIR, f"{book_code}.json")
    if os.path.exists(out_path):
        print(f"    ⏭  已存在，跳过")
        return True

    chapters_data = []
    for ch in range(1, total_chapters + 1):
        url = BASE_URL.format(num=book_num, ch=ch)
        try:
            resp = requests.get(url, timeout=TIMEOUT)
            resp.raise_for_status()
            resp.encoding = 'utf-8'
            verses_dict = parse_chapter(resp.text)

            if not verses_dict:
                print(f"    ⚠️  第 {ch} 章没有解析到经文，跳过该章")
                continue

            verses = [{"verse": v, "text": t} for v, t in sorted(verses_dict.items())]
            chapters_data.append({"chapter": ch, "verses": verses})
            print(f"    ✅  第 {ch}/{total_chapters} 章  ({len(verses)} 节)", end='\r')
            time.sleep(DELAY_SEC)

        except Exception as e:
            print(f"\n    ❌  第 {ch} 章失败: {e}")
            time.sleep(1)

    if not chapters_data:
        print(f"    ❌  {book_name} 全部章节均无数据，跳过写入")
        return False

    book_json = {
        "book": book_code,
        "version": "cnvs",
        "chapters": chapters_data
    }
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(book_json, f, ensure_ascii=False, indent=2)

    print(f"\n    💾  已保存 {out_path}  ({len(chapters_data)} 章)")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="抓取新译本（cnvs）圣经数据")
    parser.add_argument("--book",  help="只抓单卷，如 gen / mat")
    parser.add_argument("--start", type=int, default=1, help="从第几号书卷开始（1-66）")
    args = parser.parse_args()

    if args.book:
        if args.book not in BOOK_MAP:
            print(f"❗ 未知代码：{args.book}")
            sys.exit(1)
        num, name, chs = BOOK_MAP[args.book]
        fetch_book(num, args.book, name, chs)
    else:
        for num, code, name, chs in BOOKS:
            if num < args.start:
                continue
            fetch_book(num, code, name, chs)

    print("\n\n🎉  全部完成！")
