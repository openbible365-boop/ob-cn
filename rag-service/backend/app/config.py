from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "dev"
    log_level: str = "info"

    # 数据库连接
    database_url: str

    # CORS 允许来源, 逗号分隔
    cors_origins: str = ""

    # 鉴权
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 天

    # 限速
    rate_limit_login: str = "5/minute"
    rate_limit_register: str = "3/hour"

    # 大语言模型配置
    openai_api_key: str = ""
    openai_api_base: str = "https://api.openai.com/v1"
    llm_default_model: str = "gpt-4o-mini"
    llm_embedding_model: str = ""  # 如果为空，在调用时默认回退到 llm_default_model

    # RAG 配置
    rag_chunk_size: int = 900
    rag_chunk_overlap: int = 120
    rag_similarity_threshold: float = 0.3
    rag_top_k: int = 4
    embedding_batch_size: int = 16
    index_batch_size: int = 64
    embedding_timeout_seconds: float = 120.0
    embedding_max_retries: int = 3
    embedding_retry_delay_seconds: float = 20.0
    document_worker_poll_seconds: float = 3.0

    # Qdrant 向量数据库配置
    qdrant_url: str = "http://127.0.0.1:6333"
    qdrant_api_key: str = ""
    rag_internal_api_key: str = ""

    # Infinity (BGE-M3 & Reranker) 模型服务配置
    infinity_embedding_url: str = "http://127.0.0.1:7997"
    infinity_reranker_url: str = "http://127.0.0.1:7998"

    # 上传物理目录配置
    uploads_dir: str = "uploads"

    # GPU 文件服务地址（用于 RAG 检索等服务间调用）
    gpu_service_url: str = "http://127.0.0.1:8020"

    # NOTE: 共享文档账户 UUID — 该账户上传的文档对所有用户可见（如公共知识库）
    # 为空时不启用共享文档功能
    shared_doc_owner_id: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
