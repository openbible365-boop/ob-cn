from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import Optional, List, Optional

from backend.model.version import Version
from backend.schema.version import VersionCreate, VersionUpdate

async def get_versions(db: AsyncSession) -> List[Version]:
    """
    Get all Bible versions
    """
    result = await db.execute(select(Version))
    return result.scalars().all()

async def get_version_by_id(db: AsyncSession, version_id: int) -> Optional[Version]:
    """
    Get a version by its internal ID
    """
    result = await db.execute(select(Version).filter(Version.id == version_id))
    return result.scalar_one_or_none()

async def get_version_by_code(db: AsyncSession, code: str) -> Optional[Version]:
    """
    Get a version by its code (e.g. 'cuv')
    """
    result = await db.execute(select(Version).filter(Version.code == code))
    return result.scalar_one_or_none()

async def create_version(db: AsyncSession, obj_in: VersionCreate) -> Version:
    """
    Create a new Bible version
    """
    db_obj = Version(**obj_in.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def update_version(db: AsyncSession, db_obj: Version, obj_in: VersionUpdate) -> Version:
    """
    Update a Bible version
    """
    update_data = obj_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(db_obj, field, update_data[field])
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

async def delete_version(db: AsyncSession, db_obj: Version) -> Version:
    """
    Delete a Bible version
    """
    await db.delete(db_obj)
    await db.commit()
    return db_obj
