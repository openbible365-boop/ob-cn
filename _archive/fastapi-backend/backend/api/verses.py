from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Any, Dict, Optional

from backend.core.database import get_db
from backend.model.user import User
from backend.schema.verse import VerseCreate, VerseUpdate, VerseResponse, VerseBulkImport
from backend.repository import verse as verse_repo
from backend.repository.json_verse import json_verse_repo
from backend.api.deps import get_current_admin
from backend.core.config import settings

router = APIRouter(prefix="/api/verses", tags=["Verses"])

@router.get("/", response_model=Dict[str, Any])
async def read_verses(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=1000),
    version: Optional[str] = None,
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Retrieve verses (Admin only)
    Now reads directly from JSON cache.
    """
    total = json_verse_repo.count_verses(version=version, book=book, chapter=chapter, search=search)
    verses = json_verse_repo.get_verses(
        skip=skip, limit=limit, version=version, book=book, chapter=chapter, search=search
    )
    
    # 因为已经是 Dict 取值
    items = [{
        "id": f"{v['book']}-{v['chapter']}-{v['verse_num']}",  # 模拟 ID 以适配前端表格
        "version": v["version"],
        "book": v["book"],
        "chapter": v["chapter"],
        "verse_num": v["verse_num"],
        "text": v["text"]
    } for v in verses]
    
    return {
        "total": total,
        "items": items,
        "skip": skip,
        "limit": limit
    }

from fastapi.security import OAuth2PasswordBearer
from fastapi import Request
from backend.service.stats_logger import log_user_action

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

@router.get("/public", response_model=Dict[str, Any])
async def read_verses_public(
    request: Request,
    version: Optional[str] = Query("cuv"),
    book: Optional[str] = Query("gen"),
    chapter: Optional[int] = Query(1, ge=1, description="章号，须 >= 1"),
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional)
) -> Any:
    """
    Retrieve verses for a specific chapter publicly (No Auth Required)
    """
    # Optional Auth Parse check（与 api/deps.py 同样用 jose 解码；原 decode_access_token 不存在，会一直失败）
    user_id = None
    if token:
        try:
            from jose import jwt
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            sub = payload.get("sub")
            if sub is not None:
                user_id = int(sub)
        except Exception:
            pass

    # Fetch exactly what's requested from the JSON dictionary
    verses = json_verse_repo.get_verses(
        skip=0, limit=200, version=version, book=book, chapter=chapter
    )

    # Log action (容错：即使数据库写入失败，也不影响经文获取)
    try:
        ip = request.client.host if request.client else None
        log_user_action(
            db=db,
            action_type="read",
            user_id=user_id,
            book=book,
            chapter=chapter,
            version_used=version,
            ip_address=ip
        )
    except Exception as log_err:
        import logging
        logging.getLogger(__name__).warning(f"Failed to log user action to db: {log_err}")
    
    items = [{
        "verse": v["verse_num"],
        "text": v["text"],
        "heading": v.get("heading"),
    } for v in verses]

    result = {
        "version": version,
        "book": book,
        "chapter": chapter,
        "verses": items,
    }

    # 调试诊断信息(绝对路径/目录列表/cwd)仅在 DEBUG 模式返回，生产环境不泄露
    if settings.DEBUG:
        import os
        data_root_exists = os.path.exists(json_verse_repo.data_root)
        debug_files = []
        if data_root_exists:
            try:
                debug_files = os.listdir(json_verse_repo.data_root)
            except Exception as e:
                debug_files = [f"listdir error: {str(e)}"]
        else:
            try:
                parent = os.path.dirname(json_verse_repo.data_root)
                debug_files = [f"parent_path: {parent}"]
                if os.path.exists(parent):
                    debug_files.extend(os.listdir(parent))
            except Exception as e:
                debug_files.append(f"parent listdir error: {str(e)}")
        result["debug_info"] = {
            "data_root": json_verse_repo.data_root,
            "exists": data_root_exists,
            "files": debug_files,
            "cwd": os.getcwd()
        }

    return result

@router.get("/search", response_model=Dict[str, Any])
async def search_verses_public(
    q: str = Query(..., min_length=1),
    version: Optional[str] = Query("cuv"),
    testament: Optional[str] = Query(None, description="书卷范围：'ot'=旧约, 'nt'=新约, 留空=全部"),
    limit: int = Query(40, ge=1, le=100),
    offset: int = Query(0, ge=0, description="结果偏移量，支持分页/加载更多")
) -> Any:
    """
    Search verses by text publicly. 可选 testament 限定旧约/新约范围。
    支持 offset 分页，并返回 total 命中总数，避免高频字结果被静默截断而无法翻页。
    """
    from backend.service.tts import NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS

    books_filter = None
    if testament:
        tl = testament.lower()
        if tl in ("nt", "new", "新约"):
            books_filter = set(NEW_TESTAMENT_BOOKS)
        elif tl in ("ot", "old", "旧约"):
            books_filter = set(OLD_TESTAMENT_BOOKS)

    verses = json_verse_repo.get_verses(
        skip=offset, limit=limit, version=version, search=q, books=books_filter
    )
    total = json_verse_repo.count_verses(version=version, search=q, books=books_filter)

    items = [{
        "book": v["book"],
        "ch": v["chapter"],
        "verse": v["verse_num"],
        "text": v["text"]
    } for v in verses]

    return {
        "results": items,
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + len(items) < total,
    }

@router.post("/", response_model=VerseResponse, status_code=status.HTTP_201_CREATED)
async def create_verse(
    verse_in: VerseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Create specific verse (Admin only)
    """
    existing_verse = await verse_repo.get_verse_by_locator(
        db, version=verse_in.version, book=verse_in.book, chapter=verse_in.chapter, verse_num=verse_in.verse_num
    )
    if existing_verse:
        raise HTTPException(
            status_code=400,
            detail="该经文引用已存在，请修改或删除现有经文。"
        )
    return await verse_repo.create_verse(db, obj_in=verse_in)

@router.put("/{verse_id}", response_model=VerseResponse)
async def update_verse(
    verse_id: int,
    verse_in: VerseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Update a verse (Admin only)
    """
    verse = await verse_repo.get_verse_by_id(db, verse_id=verse_id)
    if not verse:
        raise HTTPException(status_code=404, detail="Verse not found")
    return await verse_repo.update_verse(db, db_obj=verse, obj_in=verse_in)

@router.delete("/{verse_id}", response_model=VerseResponse)
async def delete_verse(
    verse_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Delete a verse (Admin only)
    """
    verse = await verse_repo.get_verse_by_id(db, verse_id=verse_id)
    if not verse:
        raise HTTPException(status_code=404, detail="Verse not found")
    return await verse_repo.delete_verse(db, db_obj=verse)

@router.post("/bulk-import", response_model=Dict[str, Any])
async def bulk_import_verses(
    import_data: VerseBulkImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Bulk import verses from a deep JSON structure (Admin only).
    """
    try:
        count = await verse_repo.bulk_import_verses(db, version=import_data.version, data=import_data.data)
        return {"msg": f"批量导入成功，共影响或添加 {count} 条经文。", "count": count}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"导入解析失败，请检查格式: {str(e)}"
        )
