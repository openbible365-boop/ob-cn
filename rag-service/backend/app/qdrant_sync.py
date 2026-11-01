import asyncio
import logging
import uuid
from datetime import datetime, timezone
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models

from app.config import settings
from app.models import DocumentChunk, Document
from app.rag import get_embeddings_batch

logger = logging.getLogger(__name__)

COLLECTION_NAME = "bible_comments"


async def get_qdrant_client() -> AsyncQdrantClient:
    """
    获取 Qdrant 异步客户端
    """
    return AsyncQdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)


async def init_qdrant_collection() -> None:
    """
    初始化 Qdrant 集合。如果集合不存在，则创建。
    """
    client = await get_qdrant_client()
    try:
        await client.get_collection(COLLECTION_NAME)
    except Exception:
        logger.info(f"Creating Qdrant collection: {COLLECTION_NAME}")
        # 创建默认支持 Cosine 相似度的 1024 维稠密向量集合
        await client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=1024,  # BGE-M3 的稠密向量维度是 1024
                distance=models.Distance.COSINE
            )
        )


async def sync_chunks_to_qdrant(db, chunks: list[DocumentChunk]) -> None:
    """
    批量将带有 is_dirty = True 的 chunks 向量化，并 upsert 写入 Qdrant 向量数据库。
    """
    dirty_chunks = [c for c in chunks if c.is_dirty]
    if not dirty_chunks:
        return

    # 初始化 collection
    await init_qdrant_collection()
    qdrant_client = await get_qdrant_client()

    # 预先查询 Document 详情，避免 lazy loading 抛出 MissingGreenlet 错误
    doc_id = dirty_chunks[0].document_id
    doc = await db.get(Document, doc_id)

    batch_size = max(1, settings.index_batch_size)
    total_synced = 0
    for start in range(0, len(dirty_chunks), batch_size):
        batch = dirty_chunks[start:start + batch_size]
        texts = [chunk.content for chunk in batch]
        embeddings = None
        max_attempts = max(1, settings.embedding_max_retries)
        for attempt in range(1, max_attempts + 1):
            try:
                embeddings = await get_embeddings_batch(texts, require_all=True)
                break
            except Exception as exc:
                if attempt >= max_attempts:
                    logger.error(
                        "Embedding batch %s-%s failed after %s attempt(s): %s",
                        start + 1,
                        start + len(batch),
                        attempt,
                        exc,
                    )
                    raise
                delay = max(1.0, settings.embedding_retry_delay_seconds) * attempt
                logger.warning(
                    "Embedding batch %s-%s failed on attempt %s/%s: %s; retrying in %.1fs",
                    start + 1,
                    start + len(batch),
                    attempt,
                    max_attempts,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)

        if embeddings is None:
            raise RuntimeError("Embedding batch produced no result")

        if len(embeddings) != len(batch):
            raise RuntimeError(
                f"Embedding count mismatch during Qdrant sync: {len(embeddings)}/{len(batch)}"
            )

        points = []
        for chunk, emb in zip(batch, embeddings):
            payload = {
                "document_id": str(chunk.document_id),
                "uploaded_by": str(doc.uploaded_by) if doc else "",
                "content": chunk.content,
                "chunk_index": chunk.chunk_index,
                "title": doc.title if doc else "",
                "author": doc.author if doc else None,
                "source_type": doc.source_type if doc else None,
                "lang": doc.lang if doc else "zh",
                "tradition": doc.tradition if doc else None,
                "copyright": doc.copyright if doc else None,
                "verse_start": chunk.verse_start,
                "verse_end": chunk.verse_end,
                "page_number": chunk.page_number,
                "section_title": chunk.section_title,
            }
            points.append(
                models.PointStruct(
                    id=str(chunk.id),
                    vector=emb,
                    payload=payload,
                )
            )

        logger.info(
            "Upserting chunk batch %s-%s of %s into Qdrant collection %s",
            start + 1,
            start + len(points),
            len(dirty_chunks),
            COLLECTION_NAME,
        )
        await qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
            wait=True,
        )

        # 每批成功后立即记录进度；中断时只会重做尚未完成的批次。
        now = datetime.now(timezone.utc)
        for chunk in batch:
            chunk.is_dirty = False
            chunk.indexed_at = now
            # 向量仅保存在 Qdrant，避免 PostgreSQL 中重复保存 1024 维 JSON。
            chunk.embedding = None
        await db.commit()
        total_synced += len(points)

    logger.info("Successfully synced %s chunks and updated database state", total_synced)


async def delete_document_from_qdrant(doc_id: uuid.UUID) -> None:
    """
    根据文档 ID 从 Qdrant 中物理删除所有对应的向量切片
    """
    await init_qdrant_collection()
    qdrant_client = await get_qdrant_client()
    
    logger.info(f"Deleting vector slices for document_id {doc_id} from Qdrant")
    try:
        await qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=str(doc_id))
                    )
                ]
            )
        )
        logger.info(f"Successfully deleted vectors for document_id {doc_id}")
    except Exception as e:
        logger.error(f"Failed to delete document vectors from Qdrant: {str(e)}")
        # 不抛异常以防阻塞 PostgreSQL 里的主记录删除
