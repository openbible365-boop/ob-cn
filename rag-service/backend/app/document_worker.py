"""Durable database-backed worker for document parsing and RAG indexing."""

import asyncio
import logging
import os
import uuid

from sqlalchemy import select, update

from app.config import settings
from app.db import SessionLocal
from app.models import Document
from app.routers.documents import parse_document_task, resume_document_indexing

logger = logging.getLogger(__name__)


async def recover_interrupted_jobs() -> None:
    """Return jobs interrupted by a worker/container restart to the queue."""
    async with SessionLocal() as db:
        result = await db.execute(
            update(Document)
            .where(Document.status == "parsing")
            .values(status="pending", error_message="Recovered after worker restart")
        )
        await db.commit()
        if result.rowcount:
            logger.warning("Recovered %s interrupted document job(s)", result.rowcount)


async def claim_next_document() -> tuple[uuid.UUID, str, str, str] | None:
    """Atomically claim one pending document; supports future parallel workers."""
    async with SessionLocal() as db:
        stmt = (
            select(Document)
            .where(Document.status.in_(["indexing", "pending"]))
            .order_by(Document.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        document = (await db.execute(stmt)).scalar_one_or_none()
        if document is None:
            return None

        mode = "index" if document.status == "indexing" else "parse"
        if mode == "parse":
            document.status = "parsing"
        document.error_message = None
        await db.commit()
        return document.id, document.file_path, os.path.splitext(document.filename)[1].lower(), mode


async def run_worker() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    await recover_interrupted_jobs()
    logger.info("Document worker started")

    while True:
        job = await claim_next_document()
        if job is None:
            await asyncio.sleep(max(0.5, settings.document_worker_poll_seconds))
            continue

        doc_id, file_path, file_ext, mode = job
        logger.info("Claimed document %s for %s", doc_id, mode)
        try:
            if mode == "index":
                await resume_document_indexing(doc_id)
            else:
                await parse_document_task(doc_id, file_path, file_ext)
        except Exception:
            logger.exception("Unhandled document worker error for %s", doc_id)


if __name__ == "__main__":
    asyncio.run(run_worker())
