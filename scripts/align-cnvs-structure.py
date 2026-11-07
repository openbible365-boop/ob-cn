#!/usr/bin/env python3
"""新译本（cnvs）排版结构按和合本（cuv）对齐（可重复运行，结果不变）。

旧 cnvs 数据只有 p（段首）标记，没有小标题、诗体（q）、诗节空行（b），
所以诗篇等诗歌书无法分行、全书没有小标题；正文里还残留了源文件的换行空格。

处理：
1. 合并节编号修复：源数据把「6-7」这类合并节存成了数字 67 并排到章末，
   还原为 "6-7" 并放回正确位置。
2. 结构：按节号对应和合本，复制 p / q / b 与小标题（和合本合并节如 "17-18" 覆盖其中每一节）。
3. 空格：「神」前的半角空格换成全角（与和合本敬称留白一致），其余残留空格删除。

无法修复（需要完整的新译本数据源）：整章缺失与合并节缺失的经文，脚本只统计并列出。

用法：python3 scripts/align-cnvs-structure.py [--dry-run]
"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "bible"


def verse_range(label):
    """节号 → (起, 止)。支持 5、"17-18"。"""
    if isinstance(label, int):
        return label, label
    m = re.match(r"^(\d+)(?:-(\d+))?", str(label))
    if not m:
        return None
    start = int(m.group(1))
    return start, int(m.group(2) or start)


def fix_merged_labels(verses, expected_max):
    """把被吞掉连字符的合并节（67 → "6-7"）还原并按起始节排序。"""
    present = set()
    for v in verses:
        r = verse_range(v["verse"])
        if r and isinstance(v["verse"], int) and v["verse"] <= expected_max:
            present.add(v["verse"])
    fixed = 0
    for v in verses:
        n = v["verse"]
        if not isinstance(n, int) or n <= expected_max:
            continue
        s = str(n)
        for cut in range(1, len(s)):
            a, b = int(s[:cut]), int(s[cut:])
            if 1 <= a < b <= expected_max and b - a <= 3 and not any(x in present for x in range(a, b + 1)):
                v["verse"] = f"{a}-{b}"
                fixed += 1
                break
    verses.sort(key=lambda v: verse_range(v["verse"])[0] if verse_range(v["verse"]) else 0)
    return fixed


def clean_spaces(text):
    text = re.sub(r"[ \t]+(?=神)", "　", text)   # 敬称留白统一为全角
    text = re.sub(r"(?<=[　])[ \t]+|[ \t]+(?=[　])", "", text)
    # 中文文本里其余的半角空格都是源文件换行残留
    text = re.sub(r"(?<=[^\x00-\x7f])[ \t]+|[ \t]+(?=[^\x00-\x7f])", "", text)
    return text


def main():
    dry_run = "--dry-run" in sys.argv
    stats = {"labels": 0, "heading": 0, "q": 0, "b": 0, "p": 0, "spaces": 0}
    gaps = []
    for path in sorted((DATA / "cnvs").glob("*.json")):
        book = path.stem
        cnvs = json.loads(path.read_text(encoding="utf-8"))
        cuv = json.loads((DATA / "cuv" / path.name).read_text(encoding="utf-8"))
        cuv_chapters = {c["chapter"]: c for c in cuv["chapters"]}
        have = {c["chapter"] for c in cnvs["chapters"]}
        for ch in cuv_chapters:
            if ch not in have:
                gaps.append(f"{book} {ch}（整章缺失）")
        for chapter in cnvs["chapters"]:
            ref = cuv_chapters.get(chapter["chapter"])
            if not ref:
                continue
            # 和合本每一节（含合并节覆盖的每个节号）→ 结构
            structure = {}
            expected_max = 0
            for v in ref["verses"]:
                r = verse_range(v["verse"])
                if not r:
                    continue
                expected_max = max(expected_max, r[1])
                for n in range(r[0], r[1] + 1):
                    structure[n] = (v, n == r[0])
            stats["labels"] += fix_merged_labels(chapter["verses"], expected_max)

            covered = set()
            for v in chapter["verses"]:
                r = verse_range(v["verse"])
                if not r:
                    continue
                covered.update(range(r[0], r[1] + 1))
                src = structure.get(r[0])
                for key in ("heading", "q", "b", "p"):
                    v.pop(key, None)
                if src:
                    cuv_verse, is_start = src
                    if is_start and cuv_verse.get("heading"):
                        v["heading"] = cuv_verse["heading"]
                        stats["heading"] += 1
                    for key in ("p", "q", "b"):
                        if cuv_verse.get(key) and (is_start or key == "q"):
                            v[key] = True
                            stats[key] += 1
                cleaned = clean_spaces(v["text"])
                if cleaned != v["text"]:
                    stats["spaces"] += 1
                    v["text"] = cleaned
            missing = sorted(set(range(1, expected_max + 1)) - covered)
            if missing:
                gaps.append(f"{book} {chapter['chapter']}: 缺 {missing}")
        if not dry_run:
            path.write_text(json.dumps(cnvs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"{'[dry-run] ' if dry_run else ''}合并节编号修复 {stats['labels']} 处；"
          f"小标题 {stats['heading']}、诗体 {stats['q']}、诗节空行 {stats['b']}、段首 {stats['p']}；"
          f"清理空格 {stats['spaces']} 节")
    print(f"仍缺经文（与和合本节号对照，含新译本按底本删去的异文节）：{len(gaps)} 处")
    for line in gaps:
        print("  " + line)


if __name__ == "__main__":
    main()
