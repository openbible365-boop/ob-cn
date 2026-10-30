import asyncio
import json
import logging
import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Form, status
from fastapi.responses import StreamingResponse
from pypdf import PdfReader
from sqlalchemy import select, delete

from app.config import settings
from app.db import SessionLocal
from app.deps import CurrentUser, SessionDep, require_role
from app.models import Document, DocumentChunk, UserRole
from app.document_parser import ParsedChunk, chunk_pages, normalize_extracted_text
from app.schemas import (
    DatasetExportRequest,
    DocumentRead,
    DocumentTextRead,
)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    dependencies=[Depends(require_role(UserRole.admin))]
)

logger = logging.getLogger(__name__)


async def parse_document_task(doc_id: uuid.UUID, file_path: str, file_ext: str) -> None:
    """
    后台异步提取 PDF/TXT 纯文本任务，并在成功后执行分片与向量化 (Embedding)
    """
    logger.info(f"Starting parsing task for doc {doc_id}")
    extracted_text = ""
    error_msg = None
    status_str = "parsed"
    parsed_chunks: list[ParsedChunk] = []
    source_pages: list[tuple[int | None, str]] = []

    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError("Uploaded file not found on disk")

        loop = asyncio.get_event_loop()

        if file_ext == ".pdf":
            # NOTE: PdfReader.extract_text() 是同步阻塞操作，必须用线程池执行
            # 否则会阻塞整个 asyncio 事件循环，导致上传响应延迟数百秒
            def _parse_pdf() -> list[tuple[int | None, str]]:
                reader = PdfReader(file_path)
                pages = []
                for page_index, page in enumerate(reader.pages, start=1):
                    page_text = page.extract_text()
                    if page_text:
                        pages.append((page_index, normalize_extracted_text(page_text)))
                return pages

            source_pages = await loop.run_in_executor(None, _parse_pdf)
            extracted_text = "\n\n".join(text for _, text in source_pages)
            if not extracted_text.strip():
                raise ValueError("PDF content is empty or unreadable (may be scanned images only)")

        elif file_ext == ".txt":
            # NOTE: 同步文件读取也放入线程池，防止大文件阻塞事件循环
            def _read_txt() -> str:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()

            extracted_text = normalize_extracted_text(
                await loop.run_in_executor(None, _read_txt)
            )
            source_pages = [(None, extracted_text)]
            if not extracted_text.strip():
                raise ValueError("TXT file content is empty")

        elif file_ext == ".docx":
            # NOTE: python-docx 解析同样是同步阻塞，放入线程池
            def _parse_docx() -> str:
                import docx  # noqa: PLC0415
                doc_obj = docx.Document(file_path)
                text_chunks = [p.text for p in doc_obj.paragraphs if p.text.strip()]
                return "\n\n".join(text_chunks)

            extracted_text = normalize_extracted_text(
                await loop.run_in_executor(None, _parse_docx)
            )
            source_pages = [(None, extracted_text)]
            if not extracted_text.strip():
                raise ValueError("Word document content is empty")

        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

        # 解析阶段只生成带出处元数据的切片。Embedding 由 Qdrant 同步阶段逐批生成，
        # 避免大型注释书的全部向量同时驻留内存并重复存入 PostgreSQL。
        logger.info(f"Text extracted for doc {doc_id}, starting structure-aware chunking")
        parsed_chunks = chunk_pages(
            source_pages,
            chunk_size=settings.rag_chunk_size,
            overlap=settings.rag_chunk_overlap
        )
        if not parsed_chunks:
            raise ValueError("No usable text chunks were produced from this document")

    except Exception as e:
        logger.error(f"Error parsing doc {doc_id}: {str(e)}")
        error_msg = str(e)
        status_str = "failed"

    # 将解析出的文本、切片向量与状态统一事务写回数据库，并在事务内更新 is_dirty，调用 Qdrant 同步
    async with SessionLocal() as db:
        doc = await db.get(Document, doc_id)
        if doc:
            doc.status = status_str
            if status_str == "parsed":
                doc.extracted_text = extracted_text
                doc.error_message = None
                doc.status = "indexing"
                db_chunks = []
                # 任务可能因容器重启而被重新执行；先清除旧切片以保证幂等。
                await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc_id))
                # 批量存入切片
                for idx, parsed_chunk in enumerate(parsed_chunks):
                    db_chunk = DocumentChunk(
                        document_id=doc_id,
                        content=parsed_chunk.content,
                        chunk_index=idx,
                        embedding=None,
                        verse_start=parsed_chunk.verse_start,
                        verse_end=parsed_chunk.verse_end,
                        page_number=parsed_chunk.page_number,
                        section_title=parsed_chunk.section_title,
                        is_dirty=True
                    )
                    db.add(db_chunk)
                    db_chunks.append(db_chunk)
                
                await db.commit()
                
                # 同步写入 Qdrant 向量库（懒加载，qdrant-client 不可用时跳过）
                try:
                    from app.qdrant_sync import sync_chunks_to_qdrant  # noqa: PLC0415
                    await sync_chunks_to_qdrant(db, db_chunks)
                    doc.status = "parsed"
                    doc.error_message = None
                    await db.commit()
                except ImportError:
                    doc.status = "indexing_failed"
                    doc.error_message = "qdrant-client is not installed"
                    await db.commit()
                    logger.error("qdrant-client not installed; document indexing failed")
                except Exception as sync_err:
                    doc.status = "indexing_failed"
                    doc.error_message = str(sync_err)
                    await db.commit()
                    logger.error(f"Failed to sync chunks to Qdrant: {str(sync_err)}")
            else:
                doc.extracted_text = None
                doc.error_message = error_msg
                await db.commit()
                
            logger.info(f"Parsing task completed for doc {doc_id} with status {status_str}")


async def resume_document_indexing(doc_id: uuid.UUID) -> None:
    """Resume only the unfinished Qdrant batches for an interrupted index job."""
    async with SessionLocal() as db:
        doc = await db.get(Document, doc_id)
        if doc is None:
            return
        result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == doc_id)
            .order_by(DocumentChunk.chunk_index)
        )
        chunks = list(result.scalars().all())
        if not chunks:
            doc.status = "pending"
            doc.error_message = "Index resume found no chunks; document will be reparsed"
            await db.commit()
            return

        try:
            from app.qdrant_sync import sync_chunks_to_qdrant  # noqa: PLC0415

            await sync_chunks_to_qdrant(db, chunks)
            doc.status = "parsed"
            doc.error_message = None
        except Exception as exc:
            doc.status = "indexing_failed"
            doc.error_message = str(exc)
            logger.exception("Failed to resume Qdrant indexing for document %s", doc_id)
        await db.commit()


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    db: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    title: str | None = Form(None),
    author: str | None = Form(None),
    source_type: str | None = Form(None),
    lang: str = Form("zh"),
    tradition: str | None = Form(None),
    copyright: str | None = Form(None),
) -> Document:
    """
    上传微调资料，并触发后台纯文本解析提取任务
    """
    filename = file.filename or "unnamed_file"
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in [".pdf", ".txt", ".docx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported format. Only .pdf, .txt and .docx are allowed."
        )

    # 1. 确保物理存储目录存在
    os.makedirs(settings.uploads_dir, exist_ok=True)

    # 2. 物理保存文件
    doc_id = uuid.uuid4()
    safe_filename = f"{doc_id}_{filename}"
    file_path = os.path.join(settings.uploads_dir, safe_filename)

    file_size = 0
    try:
        with open(file_path, "wb") as f:
            while content := await file.read(1024 * 64):  # 64KB chunk
                  f.write(content)
                  file_size += len(content)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f"Failed to write file {filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file on disk"
        )

    # 3. 创建数据库记录
    doc = Document(
        id=doc_id,
        filename=filename,
        title=title or filename,
        author=author,
        source_type=source_type,
        lang=lang,
        tradition=tradition,
        copyright=copyright,
        file_path=file_path,
        file_size_bytes=file_size,
        status="pending",
        uploaded_by=current_user.id
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return doc


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    db: SessionDep,
    current_user: CurrentUser,
    limit: int = 50,
    offset: int = 0,
) -> list[Document]:
    """
    列出当前用户上传的所有资料
    """
    stmt = (
        select(Document)
        .where(Document.uploaded_by == current_user.id)
        .order_by(Document.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{doc_id}/text", response_model=DocumentTextRead)
async def get_document_text(
    doc_id: uuid.UUID,
    db: SessionDep,
    current_user: CurrentUser,
) -> Document:
    """
    获取某篇文件解析出来的纯文本
    """
    doc = await db.get(Document, doc_id)
    if not doc or doc.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: uuid.UUID,
    db: SessionDep,
    current_user: CurrentUser,
) -> None:
    """
    删除某篇微调资料（包括物理删除磁盘文件与 Qdrant 向量）
    """
    doc = await db.get(Document, doc_id)
    if not doc or doc.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # 物理删除文件
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            logger.error(f"Failed to remove physical file {doc.file_path}: {str(e)}")

    # 删除 Qdrant 向量切片（懒加载，qdrant-client 不可用时跳过）
    try:
        from app.qdrant_sync import delete_document_from_qdrant  # noqa: PLC0415
        await delete_document_from_qdrant(doc_id)
    except ImportError:
        logger.warning("qdrant-client not installed, skipping Qdrant delete")
    except Exception as qdrant_err:
        logger.error(f"Failed to delete from Qdrant: {str(qdrant_err)}")

    await db.delete(doc)
    await db.commit()


@router.post("/export")
async def export_dataset(
    payload: DatasetExportRequest,
    db: SessionDep,
    current_user: CurrentUser,
) -> StreamingResponse:
    """
    勾选多篇已解析文档进行文本分片，合并生成并导出微调 JSONL 训练集。
    支持滑动字符窗口分段导出为 OpenAI SFT 的 Chat 格式。
    """
    if not payload.document_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No documents selected"
        )

    # 拉取所有指定且解析成功的文档
    stmt = (
        select(Document)
        .where(
            Document.id.in_(payload.document_ids),
            Document.uploaded_by == current_user.id,
            Document.status == "parsed"
        )
    )
    result = await db.execute(stmt)
    docs = result.scalars().all()

    if not docs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No parsed documents found for the selected IDs"
        )

    async def jsonl_generator():
        # 合并所有文本
        full_text = "\n\n=== NEW DOCUMENT ===\n\n".join([d.extracted_text for d in docs if d.extracted_text])
        
        # 按照 chunk_size 进行切片（滑动窗口无重叠）
        chunk_size = payload.chunk_size
        text_len = len(full_text)
        
        start = 0
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunk = full_text[start:end].strip()
            start = end
            
            if not chunk:
                continue

            # 封装为 OpenAI 监督微调(SFT)标准 messages 格式
            line_data = {
                "messages": [
                    {"role": "system", "content": "你是一个阅读并精通上传资料的知识助手，请熟记该背景资料内容。"},
                    {"role": "user", "content": f"请认真阅读并记录以下学习资料：\n\n{chunk}"},
                    {"role": "assistant", "content": "好的，我已经阅读并记录了这部分背景资料，能够结合该内容回答后续提问。"}
                ]
            }
            yield json.dumps(line_data, ensure_ascii=False) + "\n"

    # 流式返回 JSONL 文件下载
    return StreamingResponse(
        jsonl_generator(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=llm_fine_tuning_dataset.jsonl"}
    )


@router.post("/{doc_id}/reindex", response_model=DocumentRead)
async def reindex_document(
    doc_id: uuid.UUID,
    db: SessionDep,
    current_user: CurrentUser,
) -> Document:
    """
    重新对已上传文档分片并生成向量索引（适合用来重试失败的向量化生成）
    """
    doc = await db.get(Document, doc_id)
    if not doc or doc.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # 1. 检查物理文件是否存在，若不存在则无法重构
    if not os.path.exists(doc.file_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Physical file not found on disk, cannot reindex."
        )

    # 2. 清除该文档已存的旧切片与 Qdrant 里的旧向量（懒加载）
    try:
        from app.qdrant_sync import delete_document_from_qdrant  # noqa: PLC0415
        await delete_document_from_qdrant(doc_id)
    except ImportError:
        logger.warning("qdrant-client not installed, skipping Qdrant delete")
    except Exception as qdrant_err:
        logger.error(f"Failed to delete from Qdrant during reindex: {str(qdrant_err)}")
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc_id))
    
    # 3. 将状态重置为 pending，由独立 worker 可靠领取任务
    doc.status = "pending"
    doc.error_message = None
    await db.commit()
    await db.refresh(doc)

    return doc
