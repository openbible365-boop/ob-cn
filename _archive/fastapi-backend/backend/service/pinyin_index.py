"""
词典首字母索引计算。
中文取拼音首字母，ASCII 字母直接大写，其余（数字/符号/无法识别）归入 '#'。
pypinyin 为软依赖：未安装时中文回退到 '#'，不影响服务启动。
"""

try:
    from pypinyin import pinyin, Style
    _HAS_PYPINYIN = True
except ImportError:  # pragma: no cover - 软依赖兜底
    _HAS_PYPINYIN = False


def first_letter(text: str) -> str:
    """返回用于词典分组的首字母（大写 A-Z 或 '#'）。"""
    if not text:
        return '#'
    ch = text.strip()[0] if text.strip() else ''
    if not ch:
        return '#'

    # ASCII 字母直接取大写
    if ch.isascii() and ch.isalpha():
        return ch.upper()

    # 中文等非 ASCII：尝试拼音首字母
    if _HAS_PYPINYIN:
        try:
            result = pinyin(ch, style=Style.FIRST_LETTER, errors='ignore')
            if result and result[0] and result[0][0]:
                letter = result[0][0][0].upper()
                if 'A' <= letter <= 'Z':
                    return letter
        except Exception:
            pass

    return '#'
