from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
from datetime import date

from backend.core.database import get_db
from backend.model.reading_plan import ReadingPlan, UserReadingPlan
from backend.api.deps import get_current_user, get_current_admin
from backend.model.user import User

router = APIRouter(prefix="/api", tags=["Reading Plans"])

# --- Admin Endpoints ---

@router.get("/admin/reading-plans")
async def admin_get_reading_plans(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_admin)):
    result = await db.execute(select(ReadingPlan).order_by(ReadingPlan.id))
    plans = result.scalars().all()
    return {"plans": [{"id": p.id, "slug": p.slug, "name_zh": p.name_zh, "name_en": p.name_en, "desc_zh": p.desc_zh, "desc_en": p.desc_en, "icon": p.icon, "gradient": p.gradient, "emoji": p.emoji, "days": p.days, "is_active": p.is_active, "schedule": p.schedule} for p in plans]}

@router.post("/admin/reading-plans")
async def admin_create_reading_plan(plan_data: Dict[str, Any], db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_admin)):
    existing = await db.execute(select(ReadingPlan).where(ReadingPlan.slug == plan_data["slug"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Plan with this slug already exists.")
    plan = ReadingPlan(**plan_data)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return {"message": "Plan created successfully", "id": plan.id}

@router.put("/admin/reading-plans/{plan_id}")
async def admin_update_reading_plan(plan_id: int, plan_data: Dict[str, Any], db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_admin)):
    plan = await db.get(ReadingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for key, value in plan_data.items():
        if hasattr(plan, key) and key != "id":
            setattr(plan, key, value)
    await db.commit()
    return {"message": "Plan updated successfully"}

@router.delete("/admin/reading-plans/{plan_id}")
async def admin_delete_reading_plan(plan_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_admin)):
    plan = await db.get(ReadingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    await db.delete(plan)
    await db.commit()
    return {"message": "Plan deleted successfully"}

@router.get("/admin/user-plans")
async def admin_get_user_plans(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_admin)):
    result = await db.execute(select(UserReadingPlan).order_by(UserReadingPlan.created_at.desc()))
    user_plans = result.scalars().all()
    # Fetch user details and plan details
    response = []
    for up in user_plans:
        user = await db.get(User, up.user_id)
        plan = await db.get(ReadingPlan, up.plan_id)
        response.append({
            "id": up.id,
            "user_id": up.user_id,
            "username": user.username if user else "Unknown",
            "email": user.email if user else "Unknown",
            "plan_id": up.plan_id,
            "plan_name": plan.name_zh if plan else "Unknown",
            "start_date": up.start_date.isoformat(),
            "current_day": up.current_day,
            "status": up.status
        })
    return {"user_plans": response}

@router.delete("/admin/user-plans/{up_id}")
async def admin_delete_user_plan(up_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_admin)):
    up = await db.get(UserReadingPlan, up_id)
    if not up:
        raise HTTPException(status_code=404, detail="User Plan not found")
    await db.delete(up)
    await db.commit()
    return {"message": "User plan deleted successfully"}


# --- Public/User Endpoints ---

@router.get("/reading-plans")
async def get_public_reading_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReadingPlan).where(ReadingPlan.is_active == True).order_by(ReadingPlan.id))
    plans = result.scalars().all()
    return {"plans": [{"id": p.id, "slug": p.slug, "name_zh": p.name_zh, "name_en": p.name_en, "desc_zh": p.desc_zh, "desc_en": p.desc_en, "icon": p.icon, "gradient": p.gradient, "emoji": p.emoji, "days": p.days, "schedule": p.schedule} for p in plans]}

@router.get("/user/reading-plans")
async def get_user_reading_plans(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(UserReadingPlan).where(UserReadingPlan.user_id == current_user.id))
    user_plans = result.scalars().all()
    
    response = []
    for up in user_plans:
        plan = await db.get(ReadingPlan, up.plan_id)
        response.append({
            "id": up.id,
            "plan_id": up.plan_id,
            "plan_slug": plan.slug if plan else None,
            "start_date": up.start_date.isoformat(),
            "current_day": up.current_day,
            "status": up.status
        })
    return {"user_plans": response}

@router.post("/user/reading-plans/{plan_id}/start")
async def start_reading_plan(plan_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = await db.get(ReadingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    # Check if already subscribed
    existing = await db.execute(select(UserReadingPlan).where(UserReadingPlan.user_id == current_user.id, UserReadingPlan.plan_id == plan_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already subscribed to this plan")

    up = UserReadingPlan(
        user_id=current_user.id,
        plan_id=plan_id,
        start_date=date.today(),
        current_day=1,
        status="active"
    )
    db.add(up)
    await db.commit()
    await db.refresh(up)
    return {"message": "Plan started", "user_plan_id": up.id}

@router.post("/user/reading-plans/{plan_id}/progress")
async def update_reading_plan_progress(plan_id: int, data: Dict[str, Any], db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    up_result = await db.execute(select(UserReadingPlan).where(UserReadingPlan.user_id == current_user.id, UserReadingPlan.plan_id == plan_id))
    up = up_result.scalar_one_or_none()
    if not up:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    if "current_day" in data:
        up.current_day = data["current_day"]
    if "status" in data:
        up.status = data["status"]
        
    await db.commit()
    return {"message": "Progress updated"}
