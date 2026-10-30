"""Structure-aware parsing helpers for commentary documents."""

from dataclasses import dataclass
import re
import unicodedata

from app.bible_parser import ALIAS_TO_BOOK, parse_verse_reference


@dataclass(frozen=True)
class ParsedChunk:
    content: str
    page_number: int | None = None
    section_title: str | None = None
    verse_start: str | None = None
    verse_end: str | None = None


_HEADING_PATTERNS = (
    re.compile(r"^第[一二三四五六七八九十百零〇\d]+[章节篇部编卷讲课]"),
    re.compile(r"^[一二三四五六七八九十百零〇]+[、.]\s*\S+"),
    re.compile(r"^\d+(?:\.\d+){0,3}[、.．]?\s*\S+"),
    re.compile(r"^(?:引言|导论|绪论|前言|结论|总结|附录|参考文献)$"),
)

# Some Chinese publishing PDFs encode the visible digits 0-9 in a private-use
# font range. Both pypdf and PDFium preserve those private-use code points,
# which otherwise breaks scripture references such as "创世记 1:1".
_PRIVATE_USE_DIGITS = str.maketrans(
    {chr(0xF643 + digit): str(digit) for digit in range(10)}
)

_BOOK_PAGE_ALIASES = sorted(
    (alias for alias in ALIAS_TO_BOOK if len(alias) >= 2), key=len, reverse=True
)
_BOOK_PAGE_HEADER = re.compile(
    rf"^({'|'.join(re.escape(alias) for alias in _BOOK_PAGE_ALIASES)})\s+\d+$",
    re.IGNORECASE,
)
_STANDALONE_NUMBER = re.compile(r"(?m)^(\d{1,3})$")
_VERSE_LINE = re.compile(r"(?m)^(\d{1,3})\s+(?=\S)")


def normalize_extracted_text(text: str) -> str:
    """Repair known PDF font mappings and normalize compatibility characters."""
    if not text:
        return ""
    repaired = text.translate(_PRIVATE_USE_DIGITS)
    repaired = unicodedata.normalize("NFKC", repaired)
    repaired = repaired.replace("\u00a0", " ").replace("\x00", "")
    return repaired.replace("\r\n", "\n").replace("\r", "\n")


def _looks_like_heading(line: str) -> bool:
    candidate = " ".join(line.split())
    if not candidate or len(candidate) > 80:
        return False
    if any(pattern.search(candidate) for pattern in _HEADING_PATTERNS):
        return True
    # Short isolated lines without sentence-ending punctuation are commonly PDF headings.
    return len(candidate) <= 28 and not re.search(r"[。！？；，,:：.!?;]$", candidate)


def _best_break(text: str, start: int, target_end: int) -> int:
    """Prefer paragraph/sentence boundaries near the requested chunk size."""
    if target_end >= len(text):
        return len(text)

    search_start = start + int((target_end - start) * 0.65)
    segment = text[search_start:target_end]
    for markers in (("\n\n",), ("。", "！", "？", ". ", "! ", "? "), ("\n",)):
        best = max((segment.rfind(marker) + len(marker) for marker in markers), default=0)
        if best > 0:
            return search_start + best
    return target_end


def _chunk_page_text(
    text: str,
    *,
    page_number: int | None,
    chunk_size: int,
    overlap: int,
    inherited_heading: str | None,
    inherited_book_id: str | None,
    inherited_chapter: int | None,
) -> tuple[list[ParsedChunk], str | None, str | None, int | None]:
    normalized_lines = [
        " ".join(line.split()) for line in normalize_extracted_text(text).splitlines()
    ]
    normalized = "\n".join(line for line in normalized_lines if line).strip()
    if not normalized:
        return [], inherited_heading, inherited_book_id, inherited_chapter

    heading = inherited_heading
    for line in normalized_lines:
        if _looks_like_heading(line):
            heading = " ".join(line.split())[:255]
            break

    book_id = inherited_book_id
    for line in normalized_lines[:5]:
        header_match = _BOOK_PAGE_HEADER.match(line.lower())
        if header_match:
            book_id = ALIAS_TO_BOOK.get(header_match.group(1).replace(" ", "").lower())
            break

    chapter_markers = [
        (match.start(), int(match.group(1)))
        for match in _STANDALONE_NUMBER.finditer(normalized)
        if 1 <= int(match.group(1)) <= 150
    ]

    chunks: list[ParsedChunk] = []
    start = 0
    safe_overlap = max(0, min(overlap, max(0, chunk_size - 1)))
    while start < len(normalized):
        end = _best_break(normalized, start, min(start + chunk_size, len(normalized)))
        content = normalized[start:end].strip()
        if content:
            chapter = inherited_chapter
            markers_before_or_near_start = [
                marker
                for marker in chapter_markers
                if marker[0] <= start + min(200, max(0, end - start) // 4)
            ]
            marker_near_start = None
            if markers_before_or_near_start:
                marker_near_start = markers_before_or_near_start[-1]
                chapter = marker_near_start[1]

            verse_info = None
            if book_id and chapter:
                verse_matches = [int(match.group(1)) for match in _VERSE_LINE.finditer(content)]
                marker_is_inside_chunk = (
                    marker_near_start is not None and marker_near_start[0] >= start
                )
                if marker_is_inside_chunk:
                    start_verse = 1
                elif verse_matches:
                    start_verse = verse_matches[0]
                else:
                    start_verse = 1
                end_verse = verse_matches[-1] if verse_matches else 999
                verse_info = (
                    f"{book_id}.{chapter}.{start_verse}",
                    f"{book_id}.{chapter}.{end_verse}",
                )
            else:
                verse_info = parse_verse_reference(content)
            chunks.append(
                ParsedChunk(
                    content=content,
                    page_number=page_number,
                    section_title=heading,
                    verse_start=verse_info[0] if verse_info else None,
                    verse_end=verse_info[1] if verse_info else None,
                )
            )
        if end >= len(normalized):
            break
        next_start = max(start + 1, end - safe_overlap)
        # Do not begin in the middle of whitespace left by PDF line wrapping.
        while next_start < end and normalized[next_start].isspace():
            next_start += 1
        start = next_start

    final_chapter = chapter_markers[-1][1] if chapter_markers else inherited_chapter
    return chunks, heading, book_id, final_chapter


def chunk_pages(
    pages: list[tuple[int | None, str]],
    *,
    chunk_size: int = 800,
    overlap: int = 100,
) -> list[ParsedChunk]:
    """Chunk page-aware text while preserving source-page and nearby heading metadata."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero")

    chunks: list[ParsedChunk] = []
    heading: str | None = None
    book_id: str | None = None
    chapter: int | None = None
    for page_number, page_text in pages:
        page_chunks, heading, book_id, chapter = _chunk_page_text(
            page_text,
            page_number=page_number,
            chunk_size=chunk_size,
            overlap=overlap,
            inherited_heading=heading,
            inherited_book_id=book_id,
            inherited_chapter=chapter,
        )
        chunks.extend(page_chunks)
    return chunks
