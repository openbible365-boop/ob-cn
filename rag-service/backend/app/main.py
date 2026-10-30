import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.ratelimit import limiter
from app.routers import admin, auth, chat, documents, retrieval, wiki


def create_app() -> FastAPI:
    app = FastAPI(title="llm-chat", version="0.1.0")

    # 自动创建本地上传目录
    os.makedirs(settings.uploads_dir, exist_ok=True)

    # slowapi: 把限速器挂到 app.state, 注册超限异常处理器(返回 429 + 详细头)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    if settings.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(chat.router)
    app.include_router(admin.router)
    app.include_router(documents.router)
    app.include_router(retrieval.router)
    app.include_router(wiki.router)

    return app


app = create_app()
