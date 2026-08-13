from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class SpiritualQuestionBase(BaseModel):
    question_text: str
    category: str = "general"
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0
    stage_id: int

class SpiritualQuestionCreate(SpiritualQuestionBase):
    pass

class SpiritualQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    stage_id: Optional[int] = None

class SpiritualQuestion(SpiritualQuestionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SpiritualStageBase(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0

class SpiritualStageCreate(SpiritualStageBase):
    pass

class SpiritualStageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None

class SpiritualStage(SpiritualStageBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    questions: List[SpiritualQuestion] = []

    model_config = ConfigDict(from_attributes=True)
