from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = None
    google_id: Optional[str] = None
    role: Optional[str] = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

class GoogleLogin(BaseModel):
    token: str

class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    plan: str = "free"
    plan_expires_at: Optional[datetime] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None

    model_config = {
        "from_attributes": True
    }
