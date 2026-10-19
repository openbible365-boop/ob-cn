from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from backend.core.database import get_db
from backend.model.user import User
from backend.model.support_plan import SupportPlan
from backend.schema.support_plan import SupportPlanResponse, SupportPlanUpdate
from backend.api.deps import get_current_admin

router = APIRouter(tags=["SupportPlans"])

# 1. 公开接口获取套餐列表 (无需鉴权)
@router.get("/api/support-plans/public", response_model=List[SupportPlanResponse])
async def get_public_support_plans(db: AsyncSession = Depends(get_db)):
    """
    获取所有的支持套餐计划列表 (前台匿名用户可访问，用于渲染支持弹窗)
    """
    result = await db.execute(select(SupportPlan).order_by(SupportPlan.sort_order.asc()))
    plans = result.scalars().all()
    return plans

# 2. 管理端接口获取套餐列表 (管理员权限)
@router.get("/api/admin/support-plans", response_model=List[SupportPlanResponse])
async def get_admin_support_plans(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    获取所有的支持套餐计划列表 (仅限管理员访问)
    """
    result = await db.execute(select(SupportPlan).order_by(SupportPlan.sort_order.asc()))
    plans = result.scalars().all()
    return plans

# 3. 管理端接口编辑套餐 (热更新)
@router.put("/api/admin/support-plans/{plan_id}", response_model=SupportPlanResponse)
async def update_support_plan(
    plan_id: str,
    plan_in: SupportPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """
    编辑修改指定的支持套餐计划配置 (仅限管理员访问)
    """
    result = await db.execute(select(SupportPlan).where(SupportPlan.id == plan_id))
    db_plan = result.scalars().first()
    
    if not db_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到ID为 {plan_id} 的支持套餐计划"
        )
        
    # 动态更新传入的字段
    update_data = plan_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_plan, field, value)
        
    await db.commit()
    await db.refresh(db_plan)
    return db_plan
