from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from sqlalchemy.orm import load_only
from typing import List, Optional, Tuple
import uuid

from backend.model.encyclopedia import EncyclopediaEntry
from backend.schema.encyclopedia import EncyclopediaCreate, EncyclopediaUpdate
from backend.service.pinyin_index import first_letter


def _apply_filters(stmt, entry_type=None, category=None, only_active=False, q=None, letter=None,
                   include_content=False, include_category=True):
    """把通用过滤条件套到 select 语句上(列表与计数共用，确保两者口径一致)。

    搜索范围可控：
      include_category=True  关键词匹配分类(默认；后台列表用)
      include_content=True   关键词匹配释义正文(content_*)
    前台词典「仅按词名」搜索时二者皆 False，只匹配三语标题。
    """
    if entry_type:
        stmt = stmt.where(EncyclopediaEntry.entry_type == entry_type)
    if category:
        stmt = stmt.where(EncyclopediaEntry.category == category)
    if only_active:
        stmt = stmt.where(EncyclopediaEntry.is_active == True)  # noqa: E712
    if letter:
        stmt = stmt.where(EncyclopediaEntry.index_letter == letter.upper())
    if q:
        kw = f"%{q.strip()}%"
        conds = [
            EncyclopediaEntry.title_zh.ilike(kw),
            EncyclopediaEntry.title_en.ilike(kw),
            EncyclopediaEntry.title_ko.ilike(kw),
        ]
        if include_category:
            conds.append(EncyclopediaEntry.category.ilike(kw))
        if include_content:
            conds += [
                EncyclopediaEntry.content_zh.ilike(kw),
                EncyclopediaEntry.content_en.ilike(kw),
                EncyclopediaEntry.content_ko.ilike(kw),
            ]
        stmt = stmt.where(or_(*conds))
    return stmt


def _auto_index_letter(data: dict) -> None:
    """词典条目若未显式给 index_letter，则按标题(zh 优先, 退 en)自动算首字母。原地修改 data。"""
    if data.get('entry_type') == 'dictionary' and not data.get('index_letter'):
        title = data.get('title_zh') or data.get('title_en') or ''
        if title:
            data['index_letter'] = first_letter(title)


async def get_entries(
    db: AsyncSession,
    entry_type: Optional[str] = None,
    category: Optional[str] = None,
    only_active: bool = False,
    limit: Optional[int] = None,
) -> List[EncyclopediaEntry]:
    stmt = _apply_filters(select(EncyclopediaEntry), entry_type, category, only_active)
    stmt = stmt.order_by(
        EncyclopediaEntry.sort_order.asc(),
        EncyclopediaEntry.created_at.desc(),
    )
    if limit:
        stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# 列表只读所需的轻量列，避免把三语长文(content/summary)从库里搬出来。
_LIST_COLS = (
    EncyclopediaEntry.id, EncyclopediaEntry.entry_type, EncyclopediaEntry.category,
    EncyclopediaEntry.index_letter, EncyclopediaEntry.cover_style, EncyclopediaEntry.author,
    EncyclopediaEntry.sort_order, EncyclopediaEntry.is_active,
    EncyclopediaEntry.title_zh, EncyclopediaEntry.title_en, EncyclopediaEntry.title_ko,
)


async def list_entries_page(
    db: AsyncSession,
    entry_type: Optional[str] = None,
    category: Optional[str] = None,
    only_active: bool = False,
    q: Optional[str] = None,
    letter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    include_content: bool = False,
    include_category: bool = True,
    with_content: bool = False,
) -> Tuple[List[EncyclopediaEntry], int]:
    """分页 + 搜索 + 首字母过滤；返回 (当页条目, 命中总数)。

    用窗口函数 count(*) OVER() 把「总数」并入同一条查询，省去单独的 COUNT 往返——
    对高网络延迟的 Neon 连接尤其重要(每次往返成本高)。
    with_content=True 时把释义正文(content_*)一并取出(用于结果少的搜索，省去逐条展开再请求)。
    """
    base = lambda s: _apply_filters(s, entry_type, category, only_active, q, letter, include_content, include_category)  # noqa: E731

    cols = list(_LIST_COLS)
    if with_content:
        cols += [EncyclopediaEntry.content_zh, EncyclopediaEntry.content_en, EncyclopediaEntry.content_ko]
    stmt = base(select(EncyclopediaEntry, func.count().over().label("_total"))
                .options(load_only(*cols)))
    stmt = stmt.order_by(
        EncyclopediaEntry.sort_order.asc(),
        EncyclopediaEntry.created_at.desc(),
    ).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()
    if not rows:
        return [], 0
    items = [r[0] for r in rows]
    total = int(rows[0][1] or 0)
    return items, total


async def get_entry(db: AsyncSession, entry_id: str) -> Optional[EncyclopediaEntry]:
    stmt = select(EncyclopediaEntry).where(EncyclopediaEntry.id == entry_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_entry(db: AsyncSession, item_in: EncyclopediaCreate) -> EncyclopediaEntry:
    data = item_in.model_dump() if hasattr(item_in, "model_dump") else item_in.dict()
    if not data.get('id'):
        data['id'] = str(uuid.uuid4())
    _auto_index_letter(data)
    db_item = EncyclopediaEntry(**data)
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


async def update_entry(db: AsyncSession, entry_id: str, item_in: EncyclopediaUpdate) -> Optional[EncyclopediaEntry]:
    db_item = await get_entry(db, entry_id)
    if not db_item:
        return None

    update_data = item_in.model_dump(exclude_unset=True) if hasattr(item_in, "model_dump") else item_in.dict(exclude_unset=True)

    # 词典：标题变了而未显式提供首字母时，重算首字母
    if not update_data.get('index_letter'):
        entry_type = update_data.get('entry_type', db_item.entry_type)
        if entry_type == 'dictionary' and ('title_zh' in update_data or 'title_en' in update_data):
            title = update_data.get('title_zh') or db_item.title_zh or update_data.get('title_en') or db_item.title_en or ''
            if title:
                update_data['index_letter'] = first_letter(title)

    for key, value in update_data.items():
        setattr(db_item, key, value)

    await db.commit()
    await db.refresh(db_item)
    return db_item


async def delete_entry(db: AsyncSession, entry_id: str) -> bool:
    db_item = await get_entry(db, entry_id)
    if not db_item:
        return False
    await db.delete(db_item)
    await db.commit()
    return True
