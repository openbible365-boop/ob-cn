import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.core.config import settings
from backend.core.database import engine, Base
from backend.model import stats, ai, user_note, support_plan, encyclopedia  # ensures models are loaded into Base.metadata

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from sqlalchemy import text
    # 初始化数据库表
    if not settings.DATABASE_URL.startswith("sqlite"):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                # 为 users 表追加新列以防表已存在而没有这些列 (PostgreSQL 语法)
                for column_name, column_type in [
                    ("plan", "VARCHAR(50) DEFAULT 'free'"),
                    ("plan_expires_at", "TIMESTAMP WITH TIME ZONE"),
                    ("stripe_customer_id", "VARCHAR(255)"),
                    ("stripe_subscription_id", "VARCHAR(255)")
                ]:
                    try:
                        await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column_name} {column_type};"))
                    except Exception as col_err:
                        logger.warning(f"Failed to add column {column_name} (might already exist): {col_err}")
            logger.info("Database tables initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize database tables: {e}")
    else:
        # SQLite 增量添加列脚本（SQLite 不支持 IF NOT EXISTS，需静默忽略已存在列报错）
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                for column_name, column_type in [
                    ("plan", "VARCHAR(50) DEFAULT 'free'"),
                    ("plan_expires_at", "DATETIME"),
                    ("stripe_customer_id", "VARCHAR(255)"),
                    ("stripe_subscription_id", "VARCHAR(255)")
                ]:
                    try:
                        await conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type};"))
                    except Exception:
                        pass
            logger.info("SQLite local database verified.")
        except Exception as e:
            logger.error(f"Failed to initialize SQLite database: {e}")
    yield
    # 关闭数据库连接
    await engine.dispose()

from backend.api import auth, users, ai, verses, books, versions, chapter_audios, study_notes, stats, commentary, reading_plans, user_notes, payment, support_plans
from backend.api import settings as settings_api
from backend.api import tts as tts_api
from backend.api import spiritual as spiritual_api
from backend.api import ai_eval as ai_eval_api
from backend.api import media as media_api
from backend.api import encyclopedia as encyclopedia_api

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# 注册路由
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(users.public_router)
app.include_router(ai.router)
app.include_router(verses.router)
app.include_router(books.router)
app.include_router(versions.router)
app.include_router(chapter_audios.router)
app.include_router(study_notes.router)
app.include_router(stats.router)
app.include_router(commentary.router)
app.include_router(reading_plans.router)
app.include_router(user_notes.router)
app.include_router(settings_api.router)
app.include_router(settings_api.public_router)  # 公开配置接口（无需鉴权）
app.include_router(tts_api.router)
app.include_router(spiritual_api.router)
app.include_router(spiritual_api.public_router)
app.include_router(ai_eval_api.router)
app.include_router(media_api.router, prefix="/api/media", tags=["media"])
app.include_router(payment.router)
app.include_router(support_plans.router)
app.include_router(encyclopedia_api.router)
app.include_router(encyclopedia_api.public_router)

# 配置跨域：开发(DEBUG)放开所有来源；生产用显式白名单(环境变量 CORS_ORIGINS，逗号分隔)。
# 注意：allow_origins=['*'] 与 allow_credentials=True 同用时浏览器会忽略凭证，且有安全风险，故按环境区分。
import os as _os
if settings.DEBUG:
    _cors_kwargs = dict(allow_origins=["*"], allow_credentials=False)
else:
    _allowed = [o.strip() for o in _os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
    _cors_kwargs = dict(allow_origins=_allowed, allow_credentials=True)
app.add_middleware(
    CORSMiddleware,
    allow_methods=["*"],
    allow_headers=["*"],
    **_cors_kwargs,
)

# NOTE: 使用绝对路径确保无论从哪个目录启动 uvicorn 都能找到静态文件
import os
import pathlib
ROOT_DIR = pathlib.Path(__file__).parent.parent  # 项目根目录

for dir_name in ["css", "js", "assets", "images", "data"]:
    dir_path = ROOT_DIR / dir_name
    if dir_path.exists() and dir_path.is_dir():
        app.mount(f"/{dir_name}", StaticFiles(directory=str(dir_path)), name=dir_name)
    else:
        logger.warning(f"Static directory '{dir_name}' not found, skipping mount.")

# 移动端已改由 mobile-app（Capacitor）承载，原 APP/ 静态目录随整合一并移除。

@app.get("/")
async def read_index():
    from fastapi.responses import FileResponse
    import pathlib
    root = pathlib.Path(__file__).parent.parent
    return FileResponse(str(root / "index.html"))

# 全局异常捕获示例
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    import traceback
    error_detail = traceback.format_exc()
    logger.error(f"Global Error Server Error: {exc}\n{error_detail}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "内部服务器错误", 
            "msg": str(exc),
            "traceback": error_detail if settings.DEBUG else "Traceback hidden"
        },
    )

@app.get("/api/health")
async def health_check() -> dict:
    """健康检查接口"""
    return {"status": "ok", "project": settings.PROJECT_NAME}

@app.get("/api/debug-env")
async def debug_env():
    import os
    from fastapi import HTTPException
    # 仅在 DEBUG 模式暴露，生产环境返回 404，避免泄露环境变量名/路径等系统信息
    if not settings.DEBUG:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "env_keys": list(os.environ.keys()),
        "cwd": os.getcwd(),
        "ls": os.listdir("."),
        "db_url_start": settings.DATABASE_URL[:20] if settings.DATABASE_URL else None
    }

# TODO: 注册其它路由
