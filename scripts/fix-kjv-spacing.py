#!/usr/bin/env python3
"""修复 data/bible/kjv 的粘连空格（一次性数据修复，可重复运行，结果不变）。

原因：旧 KJV 数据由 USFM 转换时，去掉 \\nd（神名 LORD/GOD，原文用小型大写）和
\\wj（耶稣的话）标记时把两侧空格一并吃掉了，于是出现 "theLordis my shepherd"、
"said unto him,Verily" 这类粘连（约 6,700 处）。

规则：
1. 被吃掉空格的 \\nd 词两侧都粘连（或一侧是标点 / 句首句尾），据此识别并还原为大写
   LORD / GOD（显示层再渲染成小型大写，英文圣经标准排版）；只有一侧粘连的 Lord/God
   是普通称呼，保持原样。
2. 其余小写后紧跟大写的粘连、标点后紧跟字母的粘连，补一个空格。

用法：python3 scripts/fix-kjv-spacing.py [--dry-run]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data" / "bible" / "kjv"
PUNCT = ",;:.?!"
NAMES = ("Lord", "God")

# 词元：字母串（可带 's 所有格）或单个其他字符
TOKEN = re.compile(r"[A-Za-z]+(?:'s(?![a-z]))?|[A-Za-z]+|.", re.S)


def split_glued(text: str):
    """把文本切成 (词, 左侧是否粘连, 右侧是否粘连) 序列。"""
    # 先在「小写→大写」处切开，并记录切口
    parts = []
    for match in re.finditer(r"[A-Za-z']+|[^A-Za-z']+", text):
        chunk = match.group(0)
        if not re.match(r"[A-Za-z']", chunk):
            parts.append(chunk)
            continue
        # 在 a|B 处切，同时把 Lord/God 与其后紧跟的小写分开（"Lordis" → "Lord" "is"）
        # 呼格「O」也是大写，单独切开（"OLordour Lord" → "O" "Lord" "our"）
        pieces = re.split(r"(?<=[a-z])(?=[A-Z])|(?<=^O)(?=Lord|God)", chunk)
        expanded = []
        for piece in pieces:
            m = re.match(r"^(Lord|God)('s)?([a-z].*)$", piece)
            if m and m.group(3) not in ("s",) and not m.group(3).startswith("s "):
                expanded.append(m.group(1) + (m.group(2) or ""))
                expanded.append(m.group(3))
            else:
                expanded.append(piece)
        for index, piece in enumerate(expanded):
            parts.append(("WORD", piece, index > 0, index < len(expanded) - 1))
    return parts


def fix_text(text: str):
    changed = 0
    parts = split_glued(text)
    out = []
    for i, part in enumerate(parts):
        if isinstance(part, str):
            out.append(part)
            continue
        _, word, glued_left, glued_right = part
        base = word[:-2] if word.endswith("'s") else word
        if base in NAMES:
            prev = parts[i - 1] if i > 0 else None
            nxt = parts[i + 1] if i + 1 < len(parts) else None
            left_edge = glued_left or prev is None or (isinstance(prev, str) and prev[-1:] in PUNCT)
            right_edge = glued_right or nxt is None or (isinstance(nxt, str) and nxt[:1] in PUNCT + "'")
            # 两侧都「贴着」= 原来是 \nd 神名
            if left_edge and right_edge and (glued_left or glued_right):
                word = base.upper() + word[len(base):]
                changed += 1
        if glued_left:
            out.append(" ")
            changed += 1
        out.append(word)
    fixed = "".join(out)
    # 标点后紧跟字母（\wj 耶稣的话开头处）补空格；不动所有格撇号与数字
    fixed, n = re.subn(r"([,;:.?!])(?=[A-Za-z])", r"\1 ", fixed)
    changed += n
    return fixed, changed


def main():
    dry_run = "--dry-run" in sys.argv
    total = 0
    samples = []
    for path in sorted(ROOT.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        file_changed = False
        for chapter in data["chapters"]:
            for verse in chapter["verses"]:
                fixed, changed = fix_text(verse["text"])
                if fixed != verse["text"]:
                    if len(samples) < 12:
                        samples.append((f"{path.stem} {chapter['chapter']}:{verse['verse']}", verse["text"], fixed))
                    verse["text"] = fixed
                    total += changed
                    file_changed = True
        if file_changed and not dry_run:
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{'[dry-run] ' if dry_run else ''}修复 {total} 处")
    for ref, before, after in samples:
        print(f"\n{ref}\n  - {before[:110]}\n  + {after[:110]}")


if __name__ == "__main__":
    main()
