import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=255)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    role: str
    display_name: str | None
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserUpdate(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _at_least_one(self) -> "UserUpdate":
        if self.role is None and self.is_active is None:
            raise ValueError("must provide at least one of: role, is_active")
        return self


# ==================== LLM 相关的 Schema ====================

class ChatMessageCreate(BaseModel):
    role: str = Field(..., description="发送者角色：user, assistant, system")
    content: str = Field(..., description="消息内容")


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class ChatSessionCreate(BaseModel):
    title: str = Field(..., max_length=255, description="会话标题")


class ChatSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ChatCompletionRequest(BaseModel):
    # 支持前端直接发送单条消息（通常在当前会话下），或发送整个上下文
    message: str = Field(..., description="当前发送的消息内容")
    session_id: uuid.UUID | None = Field(default=None, description="会话ID")
    model: str | None = Field(default=None, description="调用的模型名称")
    use_rag: bool = Field(default=True, description="是否启用本地知识库外挂进行检索增强回答")
    use_wiki_rag: bool = Field(default=False, description="是否启用本地 AI Wiki 知识库检索增强回答")



# ==================== Document 相关的 Schema ====================

class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    file_size_bytes: int
    status: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class DocumentTextRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    extracted_text: str | None


class DatasetExportRequest(BaseModel):
    document_ids: list[uuid.UUID] = Field(..., description="要导出的文档 ID 列表")
    chunk_size: int = Field(default=1000, ge=100, le=5000, description="滑动窗口切片大小")


# ==================== Wiki 相关的 Schema ====================

class WikiPageCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Wiki 页面标题/概念名称")
    content: str = Field(..., description="Markdown 内容")
    summary: str | None = Field(default=None, description="简短摘要")


class WikiPageUpdate(BaseModel):
    content: str | None = Field(default=None, description="Markdown 内容")
    summary: str | None = Field(default=None, description="简短摘要")


class WikiPageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str
    summary: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class WikiJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID | None
    status: str
    log: str | None
    created_at: datetime
    updated_at: datetime


