import pytest
from app.routers.wiki import clean_markdown_block, extract_plain_summary

def test_clean_markdown_block():
    # 测试普通的 markdown 围栏包裹
    raw1 = "```markdown\n# Topic\nSome content\n```"
    assert clean_markdown_block(raw1) == "# Topic\nSome content"

    raw2 = "```\n# Topic\nSome content\n```"
    assert clean_markdown_block(raw2) == "# Topic\nSome content"

    # 测试没有包裹
    raw3 = "# Topic\nSome content"
    assert clean_markdown_block(raw3) == "# Topic\nSome content"

    # 包含多余的空白
    raw4 = "  ```markdown\n# Topic\n  "
    # clean_markdown_block 有 strip 处理
    assert clean_markdown_block(raw4) == "# Topic"


def test_extract_plain_summary():
    md = """# 耶路撒冷
[[耶路撒冷]]（Jerusalem）是位于[[犹地亚]]山区的一座[[圣地]]。
**核心教义**阐述了其重要性。
* 观点A
* 观点B
"""
    summary = extract_plain_summary(md, max_len=50)
    # 应移除标题，把 [[耶路撒冷]] 变 耶路撒冷，移除 **
    # 并且取第一段，限制长度
    assert "耶路撒冷" in summary
    assert "犹地亚" in summary
    assert "#" not in summary
    assert "[[" not in summary
    assert "**" not in summary
    assert len(summary) <= 53  # 50 + "..."
