import math
import re
import uuid
import logging
import httpx
from sqlalchemy import case, select, or_
from sqlalchemy.orm import joinedload, defer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.bible_parser import BOOK_ALIASES, parse_verse_reference
from app.models import Document, DocumentChunk

logger = logging.getLogger(__name__)


# Keep the expensive cross-encoder focused on the strongest candidates. Bible
# reading requests already contain an exact reference, so broad SQL keyword
# expansion adds latency without improving the usual result set.
SEMANTIC_RECALL_LIMIT = 24
KEYWORD_RECALL_LIMIT = 16
RERANK_CANDIDATE_LIMIT = 20


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    对文本进行切片，滑动窗口大小为 chunk_size，重叠长度为 overlap
    """
    if not text:
        return []
    chunks = []
    text_len = len(text)
    start = 0
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_len:
            break
        start += (chunk_size - overlap)
    return chunks


async def get_embeddings_batch(
    texts: list[str],
    *,
    require_all: bool = False,
) -> list[list[float]]:
    """
    批量获取 Embedding 向量。
    采用三层降级策略：
    1. 优先调用独立 BGE-M3 Infinity 嵌入服务（高质量多语言向量）
    2. 降级至 OpenAI 兼容端点（如 vLLM）
    3. 以上均不可用时返回空列表，触发调用方的关键词检索降级
    """
    if not texts:
        return []

    async def _embed_with_endpoint(
        api_url: str,
        headers: dict[str, str],
        model: str,
    ) -> list[list[float]]:
        embeddings: list[list[float]] = []
        batch_size = max(1, settings.embedding_batch_size)
        timeout = httpx.Timeout(settings.embedding_timeout_seconds)

        async with httpx.AsyncClient(timeout=timeout, trust_env=False) as client:
            for start in range(0, len(texts), batch_size):
                batch = texts[start:start + batch_size]
                response = await client.post(
                    api_url,
                    headers=headers,
                    json={"input": batch, "model": model},
                )
                response.raise_for_status()
                data = response.json().get("data", [])
                sorted_data = sorted(data, key=lambda item: item.get("index", 0))
                batch_embeddings = [item.get("embedding", []) for item in sorted_data]
                if len(batch_embeddings) != len(batch) or any(not emb for emb in batch_embeddings):
                    raise RuntimeError(
                        "Embedding service returned an incomplete batch "
                        f"({len(batch_embeddings)}/{len(batch)})"
                    )
                embeddings.extend(batch_embeddings)

        if len(embeddings) != len(texts):
            raise RuntimeError(
                f"Embedding count mismatch ({len(embeddings)}/{len(texts)})"
            )
        return embeddings

    errors: list[str] = []

    # 1. 尝试使用独立的 BGE-M3 嵌入服务
    if settings.infinity_embedding_url:
        api_url = f"{settings.infinity_embedding_url.rstrip('/')}/embeddings"
        try:
            return await _embed_with_endpoint(
                api_url,
                {"Content-Type": "application/json"},
                "BAAI/bge-m3",
            )
        except Exception as exc:
            errors.append(f"Infinity: {exc}")
            logger.warning(
                "Failed to generate complete Infinity embeddings: %s; falling back to OpenAI",
                exc,
            )

    # 2. 兜底回退：OpenAI 兼容端点（vLLM 等）
    if settings.openai_api_base:
        api_url = f"{settings.openai_api_base.rstrip('/')}/embeddings"
        headers: dict[str, str] = {
            "Content-Type": "application/json",
        }
        if settings.openai_api_key:
            headers["Authorization"] = f"Bearer {settings.openai_api_key}"

        model = settings.llm_embedding_model or settings.llm_default_model
        try:
            return await _embed_with_endpoint(api_url, headers, model)
        except Exception as exc:
            errors.append(f"OpenAI-compatible: {exc}")
            logger.warning(
                "Failed to generate complete embeddings from OpenAI-compatible endpoint: %s",
                exc,
            )

    # 3. 两层均不可用，返回空列表触发关键词检索降级
    if require_all:
        raise RuntimeError("; ".join(errors) or "No embedding service is configured")

    logger.info("RAG: No embedding service available, returning empty embeddings for keyword search fallback")
    return []


async def get_query_embedding(text: str) -> list[float] | None:
    """
    获取单个 Query 的 Embedding 向量。
    向量服务不可用时返回 None（而非抛出异常），调用方可据此直接走关键词降级路径。
    """
    try:
        embeddings = await get_embeddings_batch([text])
        if embeddings:
            return embeddings[0]
        return None
    except Exception as e:
        logger.warning(f"get_query_embedding failed: {str(e)}, returning None for keyword fallback")
        return None


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """
    计算两个向量之间的余弦相似度
    """
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_v1 = math.sqrt(sum(a * a for a in v1))
    norm_v2 = math.sqrt(sum(b * b for b in v2))
    if norm_v1 == 0.0 or norm_v2 == 0.0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)


def retrieve_by_keywords(chunks: list[DocumentChunk], query: str, limit: int = 4) -> list[tuple[DocumentChunk, float]]:
    """
    基于简易关键词匹配对切片进行排序召回
    """
    query_words = _query_terms(query)

    if not query_words:
        return []

    scored_chunks = []
    total_weight = sum(max(1, len(word)) ** 2 for word in query_words)
    for chunk in chunks:
        content_lower = chunk.content.lower()
        match_weight = sum(
            max(1, len(word)) ** 2 for word in query_words if word in content_lower
        )
        if match_weight > 0:
            score = match_weight / total_weight
            scored_chunks.append((chunk, score))

    scored_chunks.sort(key=lambda x: x[1], reverse=True)
    return scored_chunks[:limit]


def _build_owner_filter():
    """
    构造文档所有者过滤条件：包含当前用户 + 可选的共享文档账户。
    共享账户 UUID 由环境变量 SHARED_DOC_OWNER_ID 配置，为空时不添加。
    """
    shared_id_str = settings.shared_doc_owner_id
    if shared_id_str:
        try:
            shared_uuid = uuid.UUID(shared_id_str)
            return lambda user_id: or_(Document.uploaded_by == user_id, Document.uploaded_by == shared_uuid)
        except ValueError:
            logger.warning(f"SHARED_DOC_OWNER_ID '{shared_id_str}' is not a valid UUID, ignoring")
    # 无共享账户时只过滤当前用户
    return lambda user_id: Document.uploaded_by == user_id


def _qdrant_owner_values(user_id: uuid.UUID) -> list[str]:
    values = [str(user_id)]
    if settings.shared_doc_owner_id:
        try:
            shared_id = str(uuid.UUID(settings.shared_doc_owner_id))
            if shared_id not in values:
                values.append(shared_id)
        except ValueError:
            logger.warning("Invalid SHARED_DOC_OWNER_ID; shared RAG documents are disabled")
    return values


def _query_terms(query_text: str) -> list[str]:
    """Return ordered keyword terms, keeping Chinese entities ahead of single characters."""
    normalized = query_text.strip().lower()
    terms: list[str] = []

    verse_info = parse_verse_reference(query_text)
    if verse_info:
        book_id = verse_info[0].split(".", 1)[0]
        matching_aliases = sorted(
            (
                alias.lower()
                for alias in BOOK_ALIASES.get(book_id, [])
                if len(alias) >= 2 and alias.lower() in normalized
            ),
            key=len,
            reverse=True,
        )
        if matching_aliases:
            book_alias = matching_aliases[0]
            terms.append(book_alias)
            remainder = normalized.replace(book_alias, "", 1)
            remainder = re.sub(r"^\s*\d+\s*(?:章|:|：|\s)\s*\d+\s*节?", "", remainder)
            remainder = re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", remainder)
            remainder = re.sub(
                r"(?:是什么意思|什么意思|是什么|如何理解|怎么理解|如何解释|怎么解释)$",
                "",
                remainder,
            )
            if 2 <= len(remainder) <= 16:
                terms.append(remainder)

    # Quoted phrases are usually the entity the user wants explained, e.g. “神的儿子们”.
    terms.extend(
        phrase.strip()
        for phrase in re.findall(r"[\"“‘']([^\"”’']{2,16})[\"”’']", normalized)
    )

    compact = re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", normalized)
    entity = re.sub(r"^(?:请问|请解释|请说明|请分析)", "", compact)
    suffixes = (
        "主要有哪些解释",
        "有哪些解释",
        "的属灵意义是什么",
        "的属灵意义",
        "有什么意义",
        "有何意义",
        "是什么意思",
        "什么意思",
        "是什么",
        "是谁",
        "如何理解",
        "怎么理解",
        "如何解释",
        "怎么解释",
        "事件",
    )
    changed = True
    while entity and changed:
        changed = False
        for suffix in suffixes:
            if entity.endswith(suffix) and len(entity) > len(suffix):
                entity = entity[:-len(suffix)]
                changed = True
                break
    if 2 <= len(entity) <= 16:
        terms.append(entity)

    terms.extend(word.strip() for word in normalized.split() if len(word.strip()) > 1)
    if 2 <= len(compact) <= 16:
        terms.append(compact)

    # Single characters remain a low-weight fallback for OCR variants and long natural questions.
    terms.extend(char for char in compact if char.strip())

    # Preserve order, cap SQL predicates, and discard punctuation-only terms.
    return list(dict.fromkeys(term for term in terms if any(ch.isalnum() for ch in term)))[:16]


async def _retrieve_keyword_candidates(
    db: AsyncSession,
    query_text: str,
    user_id: uuid.UUID,
    *,
    limit: int = 40,
) -> list[tuple[DocumentChunk, float]]:
    terms = _query_terms(query_text)
    if not terms:
        return []
    owner_filter = _build_owner_filter()
    verse_info = parse_verse_reference(query_text)
    book_section_filter = None
    if verse_info:
        book_id = verse_info[0].split(".", 1)[0]
        aliases = [alias for alias in BOOK_ALIASES.get(book_id, []) if len(alias) >= 2]
        if aliases:
            book_section_filter = or_(
                *(DocumentChunk.section_title.ilike(f"%{alias}%") for alias in aliases)
            )
    keyword_rank = sum(
        case(
            (DocumentChunk.content.ilike(f"%{term}%"), max(1, len(term)) ** 2),
            else_=0,
        )
        for term in terms
    )
    stmt = (
        select(DocumentChunk)
        .options(joinedload(DocumentChunk.document), defer(DocumentChunk.embedding))
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(
            owner_filter(user_id),
            Document.status == "parsed",
            or_(*(DocumentChunk.content.ilike(f"%{term}%") for term in terms)),
        )
        .order_by(keyword_rank.desc())
        .limit(limit)
    )
    if book_section_filter is not None:
        stmt = stmt.where(book_section_filter)
    chunks = list((await db.execute(stmt)).scalars().all())
    return retrieve_by_keywords(chunks, query_text, limit=limit)


async def _rerank_candidates(
    query_text: str,
    candidates: list[tuple[DocumentChunk, float]],
) -> list[tuple[DocumentChunk, float]]:
    if not candidates or not settings.infinity_reranker_url:
        return candidates

    api_url = f"{settings.infinity_reranker_url.rstrip('/')}/rerank"
    payload = {
        "query": query_text,
        "documents": [chunk.content for chunk, _ in candidates],
        "model": "BAAI/bge-reranker-v2-m3",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
            response = await client.post(
                api_url,
                headers={"Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
        results = response.json().get("results", [])
        reranked = [
            (candidates[item["index"]][0], float(item["relevance_score"]))
            for item in results
            if 0 <= item.get("index", -1) < len(candidates)
        ]
        reranked.sort(key=lambda item: item[1], reverse=True)
        return reranked or candidates
    except Exception as exc:
        logger.warning("Reranker unavailable; preserving hybrid recall order: %s", exc)
        return candidates


def _prioritize_exact_candidates(
    candidates: list[tuple[DocumentChunk, float]],
    exact_chunk_ids: set[uuid.UUID],
) -> list[tuple[DocumentChunk, float]]:
    """Keep exact scripture hits ahead of semantic/reranked candidates."""
    if not exact_chunk_ids:
        return candidates
    exact = [
        (chunk, max(score, 1.0))
        for chunk, score in candidates
        if chunk.id in exact_chunk_ids
    ]
    other = [(chunk, score) for chunk, score in candidates if chunk.id not in exact_chunk_ids]
    return exact + other


def _primary_scripture_exact_ids(
    chunks: dict[uuid.UUID, DocumentChunk],
    exact_chunk_ids: set[uuid.UUID],
    verse_start: str,
) -> set[uuid.UUID]:
    """Exclude cross-references that mention a verse outside their own book section."""
    book_id = verse_start.split(".", 1)[0]
    aliases = [alias.lower() for alias in BOOK_ALIASES.get(book_id, []) if len(alias) >= 2]
    return {
        chunk_id
        for chunk_id in exact_chunk_ids
        if chunk_id in chunks
        and chunks[chunk_id].section_title
        and any(alias in chunks[chunk_id].section_title.lower() for alias in aliases)
    }


def _chunk_covers_scripture_ref(
    chunk: DocumentChunk,
    verse_ref: str,
) -> bool:
    """Check exact scripture coverage from PostgreSQL chunk metadata.

    Older Qdrant points may not contain ``verse_start`` in their payload even
    though PostgreSQL has the authoritative range.  Comparing the loaded chunk
    metadata lets those existing indexes use the exact-reference fast path
    without requiring a full re-index.
    """
    def ref_key(value: str | None) -> tuple[str, int, int] | None:
        if not value:
            return None
        parts = value.split(".")
        if len(parts) != 3:
            return None
        try:
            return parts[0], int(parts[1]), int(parts[2])
        except ValueError:
            return None

    target = ref_key(verse_ref)
    start = ref_key(chunk.verse_start)
    end = ref_key(chunk.verse_end) or start
    if not target or not start or not end:
        return False
    if target[0] != start[0] or target[0] != end[0]:
        return False
    return start[1:] <= target[1:] <= end[1:]


def _apply_keyword_phrase_bonus(
    candidates: list[tuple[DocumentChunk, float]],
    query_text: str,
) -> list[tuple[DocumentChunk, float]]:
    """Give a bounded boost to exact Chinese entities without replacing semantic reranking."""
    if parse_verse_reference(query_text):
        return candidates
    phrases = [term for term in _query_terms(query_text) if 2 <= len(term) <= 8][:2]
    if not phrases:
        return candidates
    boosted = []
    for chunk, score in candidates:
        content = chunk.content.lower()
        bonus = max(
            (min(0.35, len(phrase) * 0.08) for phrase in phrases if phrase in content),
            default=0.0,
        )
        boosted.append((chunk, min(1.0, score + bonus)))
    boosted.sort(key=lambda item: item[1], reverse=True)
    return boosted


def _apply_scripture_book_bonus(
    candidates: list[tuple[DocumentChunk, float]],
    verse_start: str | None,
) -> list[tuple[DocumentChunk, float]]:
    """Prefer candidates from the referenced Bible book when page OCR obscures chapter tags."""
    if not verse_start:
        return candidates
    book_id = verse_start.split(".", 1)[0]
    aliases = [alias.lower() for alias in BOOK_ALIASES.get(book_id, []) if len(alias) >= 2]
    boosted = []
    for chunk, score in candidates:
        section = (chunk.section_title or "").lower()
        bonus = 0.25 if any(alias in section for alias in aliases) else 0.0
        boosted.append((chunk, min(1.0, score + bonus)))
    boosted.sort(key=lambda item: item[1], reverse=True)
    return boosted


def _should_expand_with_keywords(
    verse_info: tuple[str, str] | None,
    recalled_candidate_count: int,
) -> bool:
    """Use broad SQL keyword recall only when it can materially help.

    A scripture-bound request already has exact-reference and semantic recall.
    Running multiple ``ILIKE '%term%'`` predicates over every commentary chunk
    was adding roughly ten seconds to each first interpretation in production.
    """
    return verse_info is None or recalled_candidate_count == 0


def _should_rerank_exact_results(
    primary_exact_count: int,
    _requested_limit: int,
) -> bool:
    """Only pay for GPU reranking when exact scripture recall is insufficient.

    Exact verse metadata is stronger than a semantic score for a scripture-bound
    opening interpretation.  When it already supplies enough primary-book
    commentary chunks, a remote cross-encoder adds several seconds without
    changing which source material is returned.
    """
    return primary_exact_count == 0


async def _retrieve_direct_scripture_candidates(
    db: AsyncSession,
    verse_info: tuple[str, str] | None,
    user_id: uuid.UUID,
    limit: int,
) -> list[tuple[DocumentChunk, float]]:
    """Return indexed, primary-book commentary for a scripture start verse.

    This is the hot path for the initial Huidu interpretation.  Exact metadata
    is more authoritative than semantic similarity and avoids embedding,
    vector search and reranking when enough commentary is already available.
    """
    if not verse_info:
        return []
    book_id = verse_info[0].split(".", 1)[0]
    aliases = [alias for alias in BOOK_ALIASES.get(book_id, []) if len(alias) >= 2]
    if not aliases:
        return []

    owner_filter = _build_owner_filter()
    stmt = (
        select(DocumentChunk)
        .options(joinedload(DocumentChunk.document), defer(DocumentChunk.embedding))
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(
            owner_filter(user_id),
            Document.status == "parsed",
            DocumentChunk.verse_start == verse_info[0],
            or_(
                *(DocumentChunk.section_title.ilike(f"%{alias}%") for alias in aliases)
            ),
        )
        .order_by(DocumentChunk.page_number.asc().nulls_last(), DocumentChunk.id.asc())
        .limit(limit)
    )
    chunks = list((await db.execute(stmt)).scalars().all())
    return [(chunk, 1.0) for chunk in chunks]


async def retrieve_relevant_chunks(
    db: AsyncSession,
    query_embedding: list[float] | None,
    query_text: str,
    user_id: uuid.UUID,
    limit: int = 4,
    threshold: float = 0.3
) -> list[tuple[DocumentChunk, float]]:
    """
    通过 Qdrant 检索并结合 BGE-Reranker 对检索出来的 DocumentChunk 进行重排。
    如果 Qdrant 库或连接不可用，自动降级为数据库检索 + numpy 相似度排序。
    """
    # 1. 尝试解析经文引用 (如 "约3:16" -> ("JHN.3.16", "JHN.3.16"))
    verse_info = parse_verse_reference(query_text)

    # 明确经文且资料充足时直接走 PostgreSQL 的索引化元数据查询。
    # 这条路径不需要加载向量模型，也不需要访问 Qdrant/Reranker。
    direct_scripture_chunks = await _retrieve_direct_scripture_candidates(
        db, verse_info, user_id, limit
    )
    if len(direct_scripture_chunks) >= limit:
        return direct_scripture_chunks

    # 2. 判断是否可以使用 Qdrant 向量数据库
    use_qdrant = False
    try:
        from qdrant_client import AsyncQdrantClient
        from qdrant_client.http import models
        use_qdrant = True
    except ImportError:
        logger.warning("qdrant-client not installed, falling back to relational database search")

    # 3. 如果可以使用 Qdrant，执行高维度语义检索 + 精确经文过滤
    if use_qdrant:
        try:
            # 如果查询向量为空，即时生成它
            if not query_embedding:
                query_embedding = await get_query_embedding(query_text)

            qdrant_client = AsyncQdrantClient(
                url=settings.qdrant_url, 
                api_key=settings.qdrant_api_key
            )

            # 用户本人资料与平台共享知识库都可以参与检索。
            owner_condition = models.FieldCondition(
                key="uploaded_by",
                match=models.MatchAny(any=_qdrant_owner_values(user_id)),
            )
            qdrant_filter = models.Filter(
                must=[owner_condition],
            )

            # 语义召回 Top-40；后面还会合并关键词与经文精确召回，再统一精排。
            query_response = await qdrant_client.query_points(
                collection_name="bible_comments",
                query=query_embedding,
                query_filter=qdrant_filter,
                limit=SEMANTIC_RECALL_LIMIT,
            )
            search_results = query_response.points
            semantic_scores: dict[uuid.UUID, float] = {
                uuid.UUID(str(hit.id)): float(hit.score) for hit in search_results
            }

            exact_chunk_ids: set[uuid.UUID] = set()
            if verse_info:
                # PostgreSQL owns the authoritative scripture metadata and has
                # a B-tree index for this lookup.  Avoid filtering the entire
                # Qdrant collection: older points do not consistently carry a
                # verse_start payload and an unindexed scroll costs seconds.
                owner_filter = _build_owner_filter()
                exact_stmt = (
                    select(DocumentChunk.id)
                    .join(Document, DocumentChunk.document_id == Document.id)
                    .where(
                        owner_filter(user_id),
                        Document.status == "parsed",
                        DocumentChunk.verse_start == verse_info[0],
                    )
                    .limit(20)
                )
                exact_chunk_ids = set(
                    (await db.execute(exact_stmt)).scalars().all()
                )

            if search_results or exact_chunk_ids:
                chunk_ids = list(set(semantic_scores) | exact_chunk_ids)

                # 从 PostgreSQL 批量查出切片记录并预加载 document
                stmt = (
                    select(DocumentChunk)
                    .options(joinedload(DocumentChunk.document))
                    .where(DocumentChunk.id.in_(chunk_ids))
                )
                res = await db.execute(stmt)
                chunks_map = {c.id: c for c in res.scalars().all()}
                # PostgreSQL is authoritative for verse ranges.  Merge its
                # metadata-derived hits with Qdrant payload hits so older points
                # can use the same exact-reference fast path before re-indexing.
                if verse_info:
                    exact_chunk_ids.update(
                        chunk_id
                        for chunk_id, chunk in chunks_map.items()
                        if _chunk_covers_scripture_ref(chunk, verse_info[0])
                    )
                primary_exact_ids = (
                    _primary_scripture_exact_ids(
                        chunks_map, exact_chunk_ids, verse_info[0]
                    )
                    if verse_info
                    else set()
                )

                # Only primary-book exact hits receive a perfect score. Cross-references remain
                # eligible solely when semantic retrieval independently recalled them.
                candidate_scores = dict(semantic_scores)
                for chunk_id in primary_exact_ids:
                    candidate_scores[chunk_id] = 1.0

                recalled_chunks = [
                    (chunks_map[chunk_id], score)
                    for chunk_id, score in sorted(
                        candidate_scores.items(), key=lambda item: item[1], reverse=True
                    )
                    if chunk_id in chunks_map
                ][:SEMANTIC_RECALL_LIMIT]

                # 自由提问仍使用混合召回；明确经文查询已有精确经文和语义候选，
                # 跳过昂贵的全库 ILIKE 扫描。只有完全没有候选时才降级补查。
                if _should_expand_with_keywords(verse_info, len(recalled_chunks)):
                    keyword_chunks = await _retrieve_keyword_candidates(
                        db, query_text, user_id, limit=KEYWORD_RECALL_LIMIT
                    )
                    seen_ids = {chunk.id for chunk, _ in recalled_chunks}
                    recalled_chunks.extend(
                        (chunk, score * 0.8)
                        for chunk, score in keyword_chunks[:KEYWORD_RECALL_LIMIT]
                        if chunk.id not in seen_ids
                    )

                # 4. 精确经文资料已足够时直接返回，避免一次远程 GPU 重排。
                # 自由提问或精确资料不足时仍保留 BGE-Reranker-v2-m3，保障质量。
                rerank_candidates = recalled_chunks[:RERANK_CANDIDATE_LIMIT]
                if _should_rerank_exact_results(len(primary_exact_ids), limit):
                    recalled_chunks = await _rerank_candidates(
                        query_text, rerank_candidates
                    )
                else:
                    recalled_chunks = rerank_candidates
                recalled_chunks = _apply_scripture_book_bonus(
                    recalled_chunks, verse_info[0] if verse_info else None
                )
                recalled_chunks = _apply_keyword_phrase_bonus(recalled_chunks, query_text)
                recalled_chunks = _prioritize_exact_candidates(
                    recalled_chunks, primary_exact_ids
                )

                # 过滤出符合阈值的切片，并限制为 limit 数量返回
                valid_recalled = [(chunk, score) for chunk, score in recalled_chunks if score >= threshold]
                return valid_recalled[:limit]

        except Exception as qd_err:
            logger.error(f"Qdrant retrieval process failed: {str(qd_err)}. Falling back to database RAG.")

    # 5. 兜底降级方案：从关系型数据库读取该用户符合过滤条件的 chunks 进行相似度计算。
    # 优化：如果本来就没有提供 query_embedding，直接使用 SQL LIKE 模糊匹配进行初步过滤，并限制最多加载 50 条做关键词打分召回。
    # 彻底避开加载和反序列化海量的 embedding 字段，以极速返回（防御 CPU 超载）
    if not query_embedding:
        logger.info("RAG: No query embedding provided. Directly using SQL-level keyword matching for fallback retrieval.")
        
        # 提取分词/分字用于 SQL 模糊匹配，限制前 10 个以防 SQL 过长
        words_for_filter = [w.strip().lower() for w in query_text.split() if len(w.strip()) > 1]
        if len(words_for_filter) == 1 and len(words_for_filter[0]) > 2:
            words_for_filter = list(set([c.lower() for c in words_for_filter[0] if c.strip()]))
        if not words_for_filter:
            words_for_filter = list(set([c.lower() for c in query_text if c.strip()]))
            
        filters = []
        if words_for_filter:
            filters = [DocumentChunk.content.like(f"%{w}%") for w in words_for_filter[:10]]
            
        owner_filter = _build_owner_filter()
        stmt_full = (
            select(DocumentChunk)
            .options(joinedload(DocumentChunk.document), defer(DocumentChunk.embedding))
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                owner_filter(user_id),
                Document.status == "parsed"
            )
        )
        if filters:
            stmt_full = stmt_full.where(or_(*filters))
        stmt_full = stmt_full.limit(50)
        
        res_full = await db.execute(stmt_full)
        full_chunks = res_full.scalars().all()
        return retrieve_by_keywords(full_chunks, query_text, limit)

    # 为了防止加载大文本 content 导致内存 OOM，第一阶段仅加载 id, embedding 字段
    owner_filter = _build_owner_filter()
    stmt = (
        select(DocumentChunk.id, DocumentChunk.embedding)
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(
            owner_filter(user_id),
            Document.status == "parsed"
        )
    )

    result = await db.execute(stmt)
    rows = result.all()  # 元素为 tuple: (id, embedding)

    if not rows:
        return []

    # 检查是否需要执行关键词降级检索
    use_keyword_fallback = False
    if any(r[1] is None or len(r[1]) == 0 for r in rows):
        use_keyword_fallback = True

    if use_keyword_fallback:
        logger.info("RAG: Using local keyword matching for fallback retrieval")
        words_for_filter = [w.strip().lower() for w in query_text.split() if len(w.strip()) > 1]
        if len(words_for_filter) == 1 and len(words_for_filter[0]) > 2:
            words_for_filter = list(set([c.lower() for c in words_for_filter[0] if c.strip()]))
        if not words_for_filter:
            words_for_filter = list(set([c.lower() for c in query_text if c.strip()]))

        filters = []
        if words_for_filter:
            filters = [DocumentChunk.content.like(f"%{w}%") for w in words_for_filter[:10]]

        owner_filter = _build_owner_filter()
        stmt_full = (
            select(DocumentChunk)
            .options(joinedload(DocumentChunk.document), defer(DocumentChunk.embedding))
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                owner_filter(user_id),
                Document.status == "parsed"
            )
        )
        if filters:
            stmt_full = stmt_full.where(or_(*filters))
        stmt_full = stmt_full.limit(50)

        res_full = await db.execute(stmt_full)
        full_chunks = res_full.scalars().all()
        return retrieve_by_keywords(full_chunks, query_text, limit)

    # 在内存中通过 NumPy 矩阵加速计算余弦相似度
    import numpy as np
    
    # 筛选出带有效向量的 chunks
    valid_rows = [r for r in rows if r[1] and len(r[1]) == len(query_embedding)]
    if not valid_rows:
        owner_filter = _build_owner_filter()
        stmt_full = (
            select(DocumentChunk)
            .options(joinedload(DocumentChunk.document))
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                owner_filter(user_id),
                Document.status == "parsed"
            )
        )
        stmt_full = stmt_full.limit(1000)
        res_full = await db.execute(stmt_full)
        full_chunks = res_full.scalars().all()
        return retrieve_by_keywords(full_chunks, query_text, limit)

    # 转化为 NumPy 矩阵与向量
    chunk_embeddings = np.array([r[1] for r in valid_rows], dtype=np.float32)  # 形状: (N, D)
    query_vector = np.array(query_embedding, dtype=np.float32)  # 形状: (D,)

    # 计算 L2 模长并除零保护
    chunk_norms = np.linalg.norm(chunk_embeddings, axis=1)  # 形状: (N,)
    query_norm = np.linalg.norm(query_vector)

    chunk_norms[chunk_norms == 0.0] = 1e-10
    if query_norm == 0.0:
        query_norm = 1e-10

    # 矩阵化余弦相似度计算
    similarities = np.dot(chunk_embeddings, query_vector) / (chunk_norms * query_norm)  # 形状: (N,)

    # 过滤出符合阈值要求的切片 ID
    top_scored = []
    for idx, sim in enumerate(similarities):
        if sim >= threshold:
            top_scored.append((valid_rows[idx][0], float(sim)))

    # 按 score 降序排序，取前 limit 个
    top_scored.sort(key=lambda x: x[1], reverse=True)
    target_scored = top_scored[:limit]

    if not target_scored:
        return []

    # 精准拉取这几条记录的完整信息（包括 content 和 document）
    target_ids = [item[0] for item in target_scored]
    stmt_targets = (
        select(DocumentChunk)
        .options(joinedload(DocumentChunk.document))
        .where(DocumentChunk.id.in_(target_ids))
    )
    res_targets = await db.execute(stmt_targets)
    targets_map = {c.id: c for c in res_targets.scalars().all()}

    # 恢复排序并返回
    result_chunks = []
    for chunk_id, score in target_scored:
        if chunk_id in targets_map:
            result_chunks.append((targets_map[chunk_id], score))
    return result_chunks
