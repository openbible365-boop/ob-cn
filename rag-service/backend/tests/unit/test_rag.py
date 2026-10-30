import pytest
from types import SimpleNamespace
import uuid

from app import rag
from app.rag import chunk_text, cosine_similarity, get_embeddings_batch


def test_chunk_text():
    text = "我是一个智能助手，由 Google Deepmind 团队研发。我可以帮你做很多事情。"
    # 测试切片长度和重叠
    chunks = chunk_text(text, chunk_size=10, overlap=2)
    assert len(chunks) > 0
    # 确保切片出来的每一片都非空且不超限
    for c in chunks:
        assert len(c) <= 10
        assert len(c) > 0

    # 边界情况：空文本
    assert chunk_text("") == []


def test_cosine_similarity():
    # 两个完全一样的向量
    v1 = [1.0, 2.0, 3.0]
    v2 = [1.0, 2.0, 3.0]
    assert abs(cosine_similarity(v1, v2) - 1.0) < 1e-6

    # 两个完全相反的向量
    v3 = [-1.0, -2.0, -3.0]
    assert abs(cosine_similarity(v1, v3) - (-1.0)) < 1e-6

    # 两个垂直的向量
    v4 = [1.0, 0.0]
    v5 = [0.0, 1.0]
    assert abs(cosine_similarity(v4, v5) - 0.0) < 1e-6

    # 边界情况：含零向量或不同长度
    v6 = [0.0, 0.0, 0.0]
    assert cosine_similarity(v1, v6) == 0.0
    assert cosine_similarity(v1, [1.0, 2.0]) == 0.0


def test_rag_module_has_scripture_reference_parser():
    assert rag.parse_verse_reference("创世记 1:1") == ("GEN.1.1", "GEN.1.1")


def test_query_terms_keep_chinese_entity_ahead_of_single_characters():
    terms = rag._query_terms("巴别塔事件的属灵意义是什么？")

    assert terms[0] == "巴别塔"
    assert terms.index("巴别塔") < terms.index("巴")


def test_query_terms_extract_book_and_topic_from_exact_verse_question():
    terms = rag._query_terms("创世记15:6因信称义是什么意思？")

    assert terms[:2] == ["创世记", "因信称义"]


def test_quoted_entity_is_preserved_for_keyword_retrieval():
    terms = rag._query_terms("“神的儿子们”是谁，主要有哪些解释？")

    assert terms[0] == "神的儿子们"


def test_longer_keyword_phrase_has_more_weight_than_single_character_matches():
    exact_phrase = SimpleNamespace(content="巴别塔显明人类骄傲与分散。")
    character_only = SimpleNamespace(content="这段文字提到巴，也提到别的内容。")

    results = rag.retrieve_by_keywords(
        [character_only, exact_phrase], "巴别塔事件的属灵意义是什么？", limit=2
    )

    assert results[0][0] is exact_phrase
    assert results[0][1] > results[1][1]


def test_exact_scripture_candidate_stays_first_after_reranking():
    exact_id = uuid.uuid4()
    exact = SimpleNamespace(id=exact_id)
    semantic = SimpleNamespace(id=uuid.uuid4())

    results = rag._prioritize_exact_candidates(
        [(semantic, 0.99), (exact, 0.12)], {exact_id}
    )

    assert results[0] == (exact, 1.0)
    assert results[1] == (semantic, 0.99)


def test_cross_reference_is_not_treated_as_primary_scripture_hit():
    primary_id = uuid.uuid4()
    cross_reference_id = uuid.uuid4()
    chunks = {
        primary_id: SimpleNamespace(section_title="创世记 8"),
        cross_reference_id: SimpleNamespace(section_title="出埃及记 135"),
    }

    results = rag._primary_scripture_exact_ids(
        chunks, {primary_id, cross_reference_id}, "GEN.1.1"
    )

    assert results == {primary_id}


def test_chunk_range_metadata_covers_requested_scripture_reference():
    chapter = SimpleNamespace(verse_start="LUK.11.1", verse_end="LUK.11.999")
    passage = SimpleNamespace(verse_start="LUK.11.1", verse_end="LUK.11.4")
    other = SimpleNamespace(verse_start="LUK.12.1", verse_end="LUK.12.8")

    assert rag._chunk_covers_scripture_ref(chapter, "LUK.11.1") is True
    assert rag._chunk_covers_scripture_ref(passage, "LUK.11.3") is True
    assert rag._chunk_covers_scripture_ref(other, "LUK.11.1") is False


def test_exact_entity_phrase_gets_bounded_post_rerank_bonus():
    named = SimpleNamespace(content="巴别塔使人的语言变乱。")
    generic = SimpleNamespace(content="这段内容讨论属灵意义。")

    results = rag._apply_keyword_phrase_bonus(
        [(generic, 0.64), (named, 0.60)], "巴别塔事件的属灵意义是什么？"
    )

    assert results[0][0] is named
    assert results[0][1] < 1.0


def test_scripture_query_boosts_only_matching_book_section():
    genesis = SimpleNamespace(section_title="创世记 26")
    galatians = SimpleNamespace(section_title="加拉太书 342")

    results = rag._apply_scripture_book_bonus(
        [(galatians, 0.90), (genesis, 0.80)], "GEN.15.6"
    )

    assert results[0] == (genesis, 1.0)
    assert results[1] == (galatians, 0.90)


def test_scripture_query_skips_broad_keyword_expansion_when_vector_candidates_exist():
    verse_info = ("LUK.11.1", "LUK.11.1")

    assert rag._should_expand_with_keywords(verse_info, 20) is False
    assert rag._should_expand_with_keywords(verse_info, 0) is True


def test_free_form_query_keeps_hybrid_keyword_expansion():
    assert rag._should_expand_with_keywords(None, 20) is True


def test_enough_exact_scripture_chunks_skip_gpu_reranker():
    assert rag._should_rerank_exact_results(1, 4) is False
    assert rag._should_rerank_exact_results(4, 4) is False
    assert rag._should_rerank_exact_results(6, 4) is False


def test_insufficient_exact_scripture_chunks_keep_gpu_reranker():
    assert rag._should_rerank_exact_results(0, 4) is True


class _FakeResponse:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        return None

    def json(self):
        return {"data": self._data}


class _FakeEmbeddingClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.batch_sizes = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, _url, *, headers, json):
        assert headers["Content-Type"] == "application/json"
        self.batch_sizes.append(len(json["input"]))
        return _FakeResponse(next(self.responses))


@pytest.mark.asyncio
async def test_embeddings_are_batched_and_ordered(monkeypatch):
    fake = _FakeEmbeddingClient([
        [
            {"index": 1, "embedding": [2.0]},
            {"index": 0, "embedding": [1.0]},
        ],
        [{"index": 0, "embedding": [3.0]}],
    ])
    monkeypatch.setattr(rag.settings, "embedding_batch_size", 2)
    monkeypatch.setattr(rag.settings, "infinity_embedding_url", "http://embedding")
    monkeypatch.setattr(rag.settings, "openai_api_base", "")
    monkeypatch.setattr(rag.httpx, "AsyncClient", lambda **_kwargs: fake)

    result = await get_embeddings_batch(["a", "b", "c"], require_all=True)

    assert result == [[1.0], [2.0], [3.0]]
    assert fake.batch_sizes == [2, 1]


@pytest.mark.asyncio
async def test_strict_embedding_rejects_incomplete_batch(monkeypatch):
    fake = _FakeEmbeddingClient([[{"index": 0, "embedding": [1.0]}]])
    monkeypatch.setattr(rag.settings, "embedding_batch_size", 2)
    monkeypatch.setattr(rag.settings, "infinity_embedding_url", "http://embedding")
    monkeypatch.setattr(rag.settings, "openai_api_base", "")
    monkeypatch.setattr(rag.httpx, "AsyncClient", lambda **_kwargs: fake)

    with pytest.raises(RuntimeError, match="incomplete batch"):
        await get_embeddings_batch(["a", "b"], require_all=True)
