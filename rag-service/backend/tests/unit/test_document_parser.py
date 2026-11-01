from app.document_parser import chunk_pages, normalize_extracted_text


def test_normalize_extracted_text_repairs_private_use_digits_and_compatibility_forms():
    source = "创世记 \uf645\uf644:\uf644-\uf64a\r\n理查德\u00a0D\x00"

    assert normalize_extracted_text(source) == "创世记 21:1-7\n理查德 D"


def test_chunk_pages_preserves_page_and_scripture_metadata():
    pages = [
        (12, "第一章 创造\n创世记 1:1-3 说明神是创造者。" + "这是注释内容。" * 40),
        (13, "延伸讨论\n本页继续解释经文与创造秩序。" + "补充说明。" * 40),
    ]

    chunks = chunk_pages(pages, chunk_size=160, overlap=24)

    assert len(chunks) > 2
    assert chunks[0].page_number == 12
    assert chunks[0].section_title == "第一章 创造"
    assert chunks[0].verse_start == "GEN.1.1"
    assert chunks[0].verse_end == "GEN.1.3"
    assert any(chunk.page_number == 13 for chunk in chunks)


def test_chunk_pages_never_crosses_source_pages():
    chunks = chunk_pages(
        [(1, "甲" * 250), (2, "乙" * 250)],
        chunk_size=100,
        overlap=20,
    )

    assert chunks
    assert all(not ("甲" in chunk.content and "乙" in chunk.content) for chunk in chunks)
    assert {chunk.page_number for chunk in chunks} == {1, 2}


def test_book_page_header_is_not_mistaken_for_chapter_number():
    pages = [
        (
            35,
            "创世记 25\n立约\n15\n这事以后，耶和华在异象中对亚伯兰说。\n"
            "2 亚伯兰说，主耶和华啊。\n5 于是领他走到外边。",
        ),
        (
            36,
            "创世记 26\n6 亚伯兰信耶和华，耶和华就以此为他的义。\n"
            "7 耶和华又对他说，我是耶和华。",
        ),
    ]

    chunks = chunk_pages(pages, chunk_size=500, overlap=50)
    page_36 = next(chunk for chunk in chunks if chunk.page_number == 36)

    assert page_36.section_title == "创世记 26"
    assert page_36.verse_start == "GEN.15.6"
    assert page_36.verse_end == "GEN.15.7"


def test_chunk_pages_rejects_invalid_size():
    try:
        chunk_pages([(1, "text")], chunk_size=0)
    except ValueError as exc:
        assert "chunk_size" in str(exc)
    else:
        raise AssertionError("Expected invalid chunk_size to fail")
