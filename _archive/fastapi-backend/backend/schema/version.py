from pydantic import BaseModel
from typing import Optional

class VersionBase(BaseModel):
    code: str
    name: str
    language: str
    description: Optional[str] = None

class VersionCreate(VersionBase):
    pass

class VersionUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None

class VersionResponse(VersionBase):
    id: int

    class Config:
        from_attributes = True
