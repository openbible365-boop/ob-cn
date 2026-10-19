from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from backend.core.database import get_db
from backend.api.deps import get_current_admin
from backend.model.user import User
from backend.repository import media as media_repo
from backend.schema.media import MediaItemCreate, MediaItemUpdate, MediaItemOut

router = APIRouter()

@router.get("", response_model=List[MediaItemOut])
@router.get("/", response_model=List[MediaItemOut])
async def list_media(
    media_type: Optional[str] = Query(None, description="'video' or 'audio'"),
    db: AsyncSession = Depends(get_db)
):
    """
    获取媒体资源列表（视频/音频）
    """
    return await media_repo.get_media_items(db, media_type=media_type)

@router.post("/", response_model=MediaItemOut)
async def create_media(
    item_in: MediaItemCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    创建媒体资源（仅管理员）
    """
    return await media_repo.create_media_item(db, item_in)

@router.put("/{item_id}", response_model=MediaItemOut)
async def update_media(
    item_id: str,
    item_in: MediaItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    更新媒体资源（仅管理员）
    """
    item = await media_repo.update_media_item(db, item_id, item_in)
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    return item

@router.delete("/{item_id}")
async def delete_media(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    删除媒体资源（仅管理员）
    """
    success = await media_repo.delete_media_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Media not found")
    return {"message": "Deleted successfully"}
