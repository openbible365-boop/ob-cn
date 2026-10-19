from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import uuid
from backend.model.media import MediaItem
from backend.schema.media import MediaItemCreate, MediaItemUpdate

async def get_media_items(db: AsyncSession, media_type: Optional[str] = None) -> List[MediaItem]:
    stmt = select(MediaItem)
    if media_type:
        stmt = stmt.where(MediaItem.media_type == media_type)
    stmt = stmt.order_by(MediaItem.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

async def get_media_item(db: AsyncSession, item_id: str) -> Optional[MediaItem]:
    stmt = select(MediaItem).where(MediaItem.id == item_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def create_media_item(db: AsyncSession, item_in: MediaItemCreate) -> MediaItem:
    item_data = item_in.model_dump() if hasattr(item_in, "model_dump") else item_in.dict()
    if not item_data.get('id'):
        item_data['id'] = str(uuid.uuid4())
    db_item = MediaItem(**item_data)
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def update_media_item(db: AsyncSession, item_id: str, item_in: MediaItemUpdate) -> Optional[MediaItem]:
    db_item = await get_media_item(db, item_id)
    if not db_item:
        return None
    
    update_data = item_in.model_dump(exclude_unset=True) if hasattr(item_in, "model_dump") else item_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
        
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def delete_media_item(db: AsyncSession, item_id: str) -> bool:
    db_item = await get_media_item(db, item_id)
    if not db_item:
        return False
    await db.delete(db_item)
    await db.commit()
    return True
