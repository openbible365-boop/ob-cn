from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.core.database import get_db
from backend.api.deps import get_current_admin
from backend.model.user import User
from backend.model.spiritual import SpiritualStage, SpiritualQuestion
from backend.schema import spiritual as schemas

router = APIRouter(prefix="/api/admin/spiritual", tags=["spiritual"])
public_router = APIRouter(prefix="/api/spiritual", tags=["spiritual"])

# --- Stages API ---

@router.get("/stages", response_model=List[schemas.SpiritualStage])
async def get_stages(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """获取所有属灵阶段"""
    result = await db.execute(
        select(SpiritualStage)
        .options(selectinload(SpiritualStage.questions))
        .order_by(SpiritualStage.sort_order)
    )
    return result.scalars().all()

@router.post("/stages", response_model=schemas.SpiritualStage)
async def create_stage(
    stage_in: schemas.SpiritualStageCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """创建属灵阶段"""
    stage = SpiritualStage(**stage_in.model_dump())
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    
    # Reload with questions
    result = await db.execute(
        select(SpiritualStage)
        .where(SpiritualStage.id == stage.id)
        .options(selectinload(SpiritualStage.questions))
    )
    return result.scalar_one()

@router.put("/stages/{stage_id}", response_model=schemas.SpiritualStage)
async def update_stage(
    stage_id: int,
    stage_in: schemas.SpiritualStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """更新属灵阶段"""
    result = await db.execute(select(SpiritualStage).where(SpiritualStage.id == stage_id))
    stage = result.scalars().first()
    if not stage:
        raise HTTPException(status_code=404, detail="阶段未找到")
    
    update_data = stage_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(stage, field, value)
    
    await db.commit()
    await db.refresh(stage)
    
    # Reload with questions
    result = await db.execute(
        select(SpiritualStage)
        .where(SpiritualStage.id == stage.id)
        .options(selectinload(SpiritualStage.questions))
    )
    return result.scalar_one()

@router.delete("/stages/{stage_id}")
async def delete_stage(
    stage_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """删除属灵阶段"""
    result = await db.execute(select(SpiritualStage).where(SpiritualStage.id == stage_id))
    stage = result.scalars().first()
    if not stage:
        raise HTTPException(status_code=404, detail="阶段未找到")
    
    await db.delete(stage)
    await db.commit()
    return {"status": "ok"}

# --- Questions API ---

@router.get("/questions", response_model=List[schemas.SpiritualQuestion])
async def get_questions(
    stage_id: int = None,
    category: str = None,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """获取所有属灵问题"""
    query = select(SpiritualQuestion)
    if stage_id:
        query = query.where(SpiritualQuestion.stage_id == stage_id)
    if category:
        query = query.where(SpiritualQuestion.category == category)
    query = query.order_by(SpiritualQuestion.sort_order)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/questions", response_model=schemas.SpiritualQuestion)
async def create_question(
    question_in: schemas.SpiritualQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """创建属灵问题"""
    question = SpiritualQuestion(**question_in.model_dump())
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question

@router.put("/questions/{question_id}", response_model=schemas.SpiritualQuestion)
async def update_question(
    question_id: int,
    question_in: schemas.SpiritualQuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """更新属灵问题"""
    result = await db.execute(select(SpiritualQuestion).where(SpiritualQuestion.id == question_id))
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    update_data = question_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)
    
    await db.commit()
    await db.refresh(question)
    return question

@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """删除属灵问题"""
    result = await db.execute(select(SpiritualQuestion).where(SpiritualQuestion.id == question_id))
    question = result.scalars().first()
    if not question:
        raise HTTPException(status_code=404, detail="问题未找到")
    
    await db.delete(question)
    await db.commit()
    return {"status": "ok"}

# --- Public API ---

@public_router.get("/stages", response_model=List[schemas.SpiritualStage])
async def public_get_stages(
    category: str = "general",
    db: AsyncSession = Depends(get_db)
):
    """公开接口：获取所有属灵阶段及其启用的问题（按分类过滤）"""
    result = await db.execute(
        select(SpiritualStage)
        .options(selectinload(SpiritualStage.questions))
        .order_by(SpiritualStage.sort_order)
    )
    stages = result.scalars().all()
    
    # 过滤掉非活跃的问题，并按 category 过滤
    for stage in stages:
        stage.questions = [q for q in stage.questions if q.is_active and q.category == category]
        stage.questions.sort(key=lambda x: x.sort_order)
        
    return stages
