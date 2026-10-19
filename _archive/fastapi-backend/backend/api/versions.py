from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Optional

from backend.core.database import get_db
from backend.model.user import User
from backend.schema.version import VersionCreate, VersionUpdate, VersionResponse
from backend.repository import version as version_repo
from backend.api.deps import get_current_admin

router = APIRouter(prefix="/api/versions", tags=["Versions"])

@router.get("/")
async def read_versions(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all versions (Publicly accessible) - Hardcoded for JSON source
    """
    return [
        {
            "id": 1,
            "code": "cuv",
            "name": "中文和合本 (新标点)",
            "description": "Chinese Union Version (New Punctuation)",
            "language": "zh",
            "is_default": True
        },
        {
            "id": 2,
            "code": "snr",
            "name": "새누리 SNR",
            "description": "SNR Bible Version",
            "language": "ko",
            "is_default": False
        }
    ]

@router.post("/", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def create_new_version(
    version_in: VersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Create a new version (Admin only)
    """
    existing = await version_repo.get_version_by_code(db, code=version_in.code)
    if existing:
        raise HTTPException(status_code=400, detail="Version code already exists")
    return await version_repo.create_version(db, obj_in=version_in)

@router.put("/{version_id}", response_model=VersionResponse)
async def update_existing_version(
    version_id: int,
    version_in: VersionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Update a version (Admin only)
    """
    db_obj = await version_repo.get_version_by_id(db, version_id=version_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Version not found")
    return await version_repo.update_version(db, db_obj=db_obj, obj_in=version_in)

@router.delete("/{version_id}", response_model=VersionResponse)
async def delete_existing_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Delete a version (Admin only)
    """
    db_obj = await version_repo.get_version_by_id(db, version_id=version_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Version not found")
    return await version_repo.delete_version(db, db_obj=db_obj)
