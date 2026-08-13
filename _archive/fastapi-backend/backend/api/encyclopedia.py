from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from backend.core.database import get_db
from backend.api.deps import get_current_admin
from backend.model.user import User
from backend.repository import encyclopedia as repo
from backend.schema.encyclopedia import (
    EncyclopediaCreate,
    EncyclopediaUpdate,
    EncyclopediaOut,
    EncyclopediaPage,
)

# 管理端（需 admin 鉴权）
router = APIRouter(prefix="/api/admin/encyclopedia", tags=["encyclopedia"])
# 公开端（无需鉴权，仅返回启用条目）
public_router = APIRouter(prefix="/api/encyclopedia", tags=["encyclopedia"])


# ── 管理端 CRUD ──

@router.get("/entries", response_model=EncyclopediaPage)
async def admin_list_entries(
    entry_type: Optional[str] = Query(None, description="'dictionary' | 'article' | 'devotional'"),
    q: Optional[str] = Query(None, description="按标题/分类模糊搜索"),
    letter: Optional[str] = Query(None, description="词典首字母过滤(A-Z/#)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    items, total = await repo.list_entries_page(
        db, entry_type=entry_type, q=q, letter=letter, limit=limit, offset=offset
    )
    return {"total": total, "items": items}


@router.get("/entries/{entry_id}", response_model=EncyclopediaOut)
async def admin_get_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    item = await repo.get_entry(db, entry_id)
    if not item:
        raise HTTPException(status_code=404, detail="Entry not found")
    return item


@router.post("/entries", response_model=EncyclopediaOut)
async def admin_create_entry(
    item_in: EncyclopediaCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return await repo.create_entry(db, item_in)


@router.put("/entries/{entry_id}", response_model=EncyclopediaOut)
async def admin_update_entry(
    entry_id: str,
    item_in: EncyclopediaUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    item = await repo.update_entry(db, entry_id, item_in)
    if not item:
        raise HTTPException(status_code=404, detail="Entry not found")
    return item


@router.delete("/entries/{entry_id}")
async def admin_delete_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    success = await repo.delete_entry(db, entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Deleted successfully"}


# ── 公开端（前台读取） ──

@public_router.get("/entries", response_model=List[EncyclopediaOut])
async def public_list_entries(
    entry_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # 此端点带全量长文，仅用于文章/灵修(数量少)。词典请走分页的 /dict。
    # 加安全上限做纵深防御，避免被 entry_type=dictionary 调到时一次性吐数千条(~MB)。
    return await repo.get_entries(db, entry_type=entry_type, category=category, only_active=True, limit=500)


_DICT_LIGHT_FIELDS = ("id", "entry_type", "category", "index_letter", "cover_style",
                      "author", "sort_order", "is_active", "title_zh", "title_en", "title_ko")


def _ser_dict_item(e, with_content: bool) -> dict:
    """手动序列化(避免 response_model 访问未加载列触发懒加载/异步报错)。"""
    d = {k: getattr(e, k) for k in _DICT_LIGHT_FIELDS}
    if with_content:
        d["content_zh"] = e.content_zh
        d["content_en"] = e.content_en
        d["content_ko"] = e.content_ko
    return d


@public_router.get("/dict")
async def public_dict_page(
    entry_type: str = Query("dictionary"),
    q: Optional[str] = Query(None, description="按词名搜索"),
    letter: Optional[str] = Query(None, description="首字母过滤(A-Z/#)"),
    limit: int = Query(80, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    with_content: bool = Query(False, description="是否一并返回释义(结果少的搜索用，省去逐条展开请求)"),
    db: AsyncSession = Depends(get_db),
):
    """前台词典分页/搜索：默认轻量返回(不含长文)，避免一次性拉取数千条全量正文导致超时。

    搜索仅匹配词名(三语标题)，不匹配释义/分类——「仅显示命中的词名」。
    with_content=True 时随结果带回释义(用于结果较少的搜索，展开即时显示)。
    """
    items, total = await repo.list_entries_page(
        db, entry_type=entry_type, only_active=True, q=q, letter=letter,
        limit=limit, offset=offset, include_content=False, include_category=False,
        with_content=with_content,
    )
    return {"total": total, "items": [_ser_dict_item(e, with_content) for e in items]}


@public_router.get("/entries/{entry_id}", response_model=EncyclopediaOut)
async def public_get_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
):
    item = await repo.get_entry(db, entry_id)
    if not item or not item.is_active:
        raise HTTPException(status_code=404, detail="Entry not found")
    return item
