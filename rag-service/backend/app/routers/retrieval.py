"""Authenticated internal retrieval endpoint used by the OpenBible applications."""

import hmac
import uuid

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.bible_parser import parse_verse_reference
from app.deps import SessionDep
from app.rag import get_query_embedding, retrieve_relevant_chunks


router = APIRouter(prefix="/internal", tags=["internal"])


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    user_id: uuid.UUID | None = None
    limit: int = Field(default=6, ge=1, le=12)
    threshold: float = Field(default=0.15, ge=0.0, le=1.0)


def _authorize_internal_request(provided_key: str | None) -> None:
    expected_key = settings.rag_internal_api_key
    if not expected_key:
        raise HTTPException(status_code=503, detail="RAG internal API key is not configured")
    if not provided_key or not hmac.compare_digest(provided_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid internal API key")


@router.post("/retrieve")
async def retrieve(
    payload: RetrievalRequest,
    db: SessionDep,
    x_internal_api_key: str | None = Header(default=None),
) -> list[dict]:
    _authorize_internal_request(x_internal_api_key)

    owner_id = payload.user_id
    if owner_id is None and settings.shared_doc_owner_id:
        try:
            owner_id = uuid.UUID(settings.shared_doc_owner_id)
        except ValueError:
            owner_id = None
    if owner_id is None:
        raise HTTPException(status_code=503, detail="Shared RAG owner is not configured")

    # Exact scripture requests have an indexed PostgreSQL fast path in the RAG
    # layer.  Defer embedding unless that path needs to fall back to Qdrant.
    query_embedding = (
        None
        if parse_verse_reference(payload.query)
        else await get_query_embedding(payload.query)
    )
    results = await retrieve_relevant_chunks(
        db,
        query_embedding,
        payload.query,
        owner_id,
        limit=payload.limit,
        threshold=payload.threshold,
    )
    return [
        {
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "filename": chunk.document.filename,
            "title": chunk.document.title,
            "author": chunk.document.author,
            "page_number": chunk.page_number,
            "section_title": chunk.section_title,
            "verse_start": chunk.verse_start,
            "verse_end": chunk.verse_end,
            "content": chunk.content,
            "score": score,
        }
        for chunk, score in results
    ]
