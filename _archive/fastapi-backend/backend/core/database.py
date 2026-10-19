from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from backend.core.config import settings

import logging

logger = logging.getLogger(__name__)

# SQLite 必须配置 check_same_thread: False
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
if _is_sqlite:
    connect_args = {"check_same_thread": False}
else:
    # Neon 的连接走 PgBouncer(事务级池化)，asyncpg 的预编译语句缓存与之冲突，
    # 会偶发 "InternalClientError: another operation in progress" 等错误；置 0 禁用。
    connect_args = {"statement_cache_size": 0}

# pool_pre_ping：取连接前先探活，自动剔除并重建已被服务端关闭的死连接
#   —— Neon 等 Serverless Postgres 会在空闲数分钟后关闭连接，不开启会偶发
#      "asyncpg InterfaceError: connection is closed" 导致接口 500（如百科词典列表/搜索）。
# pool_recycle：连接存活超过该秒数即主动回收，赶在 Neon 空闲超时之前。
_engine_kwargs = dict(echo=False, connect_args=connect_args, pool_pre_ping=True)
if not _is_sqlite:
    _engine_kwargs["pool_recycle"] = 280

engine = create_async_engine(
    settings.DATABASE_URL,
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

_db_initialized = False

async def get_db():
    """
    FastAPI 依赖项：获取数据库会话，并附带自适应表结构及列惰性初始化防守，
    防止 Vercel Serverless 环境跳过 lifespan.startup 事件导致数据库表未创建。
    """
    global _db_initialized
    if not _db_initialized:
        try:
            from sqlalchemy import text
            from backend.model.support_plan import SupportPlan

            # 1. 自动为 SQLite 或 Neon PostgreSQL 创建所有缺失的表 (在独立事务里)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

            # 2. 增量补齐 support_plans 表的新列（逐个在独立子事务中运行，规避 PG 大事务报错中断）
            is_sqlite = settings.DATABASE_URL.startswith("sqlite")
            for col_name, col_type in [
                ("dialogue_limit", "INTEGER DEFAULT 20"),
                ("name_en", "VARCHAR(100)"),
                ("name_ko", "VARCHAR(100)"),
                ("features_en", "TEXT"),
                ("features_ko", "TEXT"),
                ("badge_en", "VARCHAR(50)"),
                ("badge_ko", "VARCHAR(50)")
            ]:
                try:
                    async with engine.begin() as conn:
                        if not is_sqlite:
                            await conn.execute(text(f"ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                        else:
                            await conn.execute(text(f"ALTER TABLE support_plans ADD COLUMN {col_name} {col_type};"))
                except Exception as col_err:
                    # 多为「列已存在」，属正常；记 debug 便于排查真实异常，不再完全静默
                    logger.debug(f"support_plans add column {col_name} skipped: {col_err}")

            # 3. 播种支持套餐种子数据（独立子事务）
            try:
                async with engine.begin() as conn:
                    result = await conn.execute(text("SELECT COUNT(*) FROM support_plans;"))
                    count = result.scalar()
                    if count == 0:
                        await conn.execute(text("""
                            INSERT INTO support_plans (id, name, name_en, name_ko, price_monthly, price_once, badge, badge_en, badge_ko, features, features_en, features_ko, dialogue_limit, sort_order)
                            VALUES 
                            ('free', '免费计划', 'Free Plan', '무료 요금제', 0.0, 0.0, NULL, NULL, NULL,
                             '感谢众多支持者的支持，使我们能向所有人开放这份免费资源\n每月 20 次体验对话', 
                             'Thanks to our supporters, this resource remains free for all\n20 AI study dialogues per month', 
                             '많은 후원자분들의 지원 덕분에 이 무료 리소스를 모든 사람에게 개방할 수 있었습니다\n매월 20회 체험 대화', 20, 1),
                            ('basic', '基础计划', 'Basic Plan', '기본 요금제', 4.99, 5.99, NULL, NULL, NULL,
                             '以简单方式托住事工\n每月 100 次对话\n适合轻量级每周使用', 
                             'Support the ministry in a simple way\n100 AI study dialogues per month\nPerfect for light weekly study', 
                             '심플한 방식으로 사역을 후원합니다\n매월 100회 대화\n가벼운 주간 학습에 적합합니다.', 100, 2),
                            ('pro', '进阶计划', 'Pro Plan', '프리미엄 요금제', 9.99, 11.99, '热门', 'Popular', '인기', 
                             '您的支持帮助我们持续提升工具的质量与深度\n每月 300 次对话\n适合经常研经的读者', 
                             'Help us continuously improve tool quality & depth\n300 AI study dialogues per month\nGreat for regular Bible students', 
                             '도구의 품질과 깊이를 지속적으로 개선할 수 있도록 지원합니다\n매월 300회 대화\n자주 성경을 연구하는 독자에게 적합합니다.', 300, 3),
                            ('supporter', '支持者计划', 'Supporter Plan', '후원자 요금제', 14.99, 17.99, NULL, NULL, NULL,
                             '适合牧师、小组带领人或每天使用\n您的支持将代赠一份给有需要的人 — 既滋养自己，也祝福他人\n每月 400 次对话', 
                             'Ideal for pastors, group leaders, or daily study\nPay it forward — sponsor a plan for someone in need\n400 AI study dialogues per month', 
                             '목회자, 소그룹 리더 또는 매일 사용하는 분들에게 적합합니다\n필요한 분들에게 혜택을 전하여 나의 성장과 타인에 대한 축복이 함께합니다.\n매월 400회 대화', 400, 4);
                        """))
                        logger.info("Default support plans seeded successfully.")
            except Exception as seed_err:
                logger.warning(f"Failed to seed support plans: {seed_err}")

            # 4. 针对已有的 4 个默认套餐进行多语言和限额字段的补齐更新（以防列之前为空或历史数据缺失，独立子事务）
            for plan_id, fields in {
                "free": {
                    "name_en": "Free Plan", "name_ko": "무료 요금제", "dialogue_limit": 20,
                    "badge_en": None, "badge_ko": None,
                    "features_en": "Thanks to our supporters, this resource remains free for all\n20 AI study dialogues per month",
                    "features_ko": "많은 후원자분들의 지원 덕분에 이 무료 리소스를 모든 사람에게 개방할 수 있었습니다\n매월 20회 체험 대화"
                },
                "basic": {
                    "name_en": "Basic Plan", "name_ko": "기본 요금제", "dialogue_limit": 100,
                    "badge_en": None, "badge_ko": None,
                    "features_en": "Support the ministry in a simple way\n100 AI study dialogues per month\nPerfect for light weekly study",
                    "features_ko": "심플한 방식으로 사역을 후원합니다\n매월 100회 대화\n가벼운 주간 학습에 적합합니다."
                },
                "pro": {
                    "name_en": "Pro Plan", "name_ko": "프리미엄 요금제", "dialogue_limit": 300,
                    "badge_en": "Popular", "badge_ko": "인기",
                    "features_en": "Help us continuously improve tool quality & depth\n300 AI study dialogues per month\nGreat for regular Bible students",
                    "features_ko": "도구의 품질과 깊이를 지속적으로 개선할 수 있도록 지원합니다\n매월 300회 대화\n자주 성경을 연구하는 독자에게 적합합니다."
                },
                "supporter": {
                    "name_en": "Supporter Plan", "name_ko": "후원자 요금제", "dialogue_limit": 400,
                    "badge_en": None, "badge_ko": None,
                    "features_en": "Ideal for pastors, group leaders, or daily study\nPay it forward — sponsor a plan for someone in need\n400 AI study dialogues per month",
                    "features_ko": "목회자, 소그룹 리더 또는 매일 사용하는 분들에게 적합합니다\n필요한 분들에게 혜택을 전하여 나의 성장과 타인에 대한 축복이 함께합니다.\n매월 400회 대화"
                }
            }.items():
                try:
                    async with engine.begin() as conn:
                        await conn.execute(text("""
                            UPDATE support_plans 
                            SET name_en = COALESCE(name_en, :name_en), 
                                name_ko = COALESCE(name_ko, :name_ko), 
                                dialogue_limit = COALESCE(dialogue_limit, :dialogue_limit),
                                badge_en = COALESCE(badge_en, :badge_en),
                                badge_ko = COALESCE(badge_ko, :badge_ko),
                                features_en = COALESCE(features_en, :features_en),
                                features_ko = COALESCE(features_ko, :features_ko)
                            WHERE id = :plan_id AND (name_en IS NULL OR name_ko IS NULL OR dialogue_limit IS NULL OR badge_en IS NULL OR badge_ko IS NULL OR features_en IS NULL OR features_ko IS NULL);
                        """), {
                            "name_en": fields["name_en"],
                            "name_ko": fields["name_ko"],
                            "dialogue_limit": fields["dialogue_limit"],
                            "badge_en": fields["badge_en"],
                            "badge_ko": fields["badge_ko"],
                            "features_en": fields["features_en"],
                            "features_ko": fields["features_ko"],
                            "plan_id": plan_id
                        })
                except Exception as upd_err:
                    logger.warning(f"Failed to auto-update pre-existing plan {plan_id} multi-lang fields: {upd_err}")

            # 5. 增量补齐 users 表的新列（在独立事务里）
            for column_name, column_type in [
                ("plan", "VARCHAR(50) DEFAULT 'free'"),
                ("plan_expires_at", "DATETIME" if is_sqlite else "TIMESTAMP WITH TIME ZONE"),
                ("stripe_customer_id", "VARCHAR(255)"),
                ("stripe_subscription_id", "VARCHAR(255)")
            ]:
                try:
                    async with engine.begin() as conn:
                        if is_sqlite:
                            await conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type};"))
                        else:
                            await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column_name} {column_type};"))
                except Exception as col_err:
                    # 多为「列已存在」，属正常；记 debug 便于排查真实异常，不再完全静默
                    logger.debug(f"users add column {column_name} skipped: {col_err}")

            logger.info("Database initialized successfully.")
            _db_initialized = True
        except Exception as e:
            logger.error(f"Failed to auto-initialize database: {e}")
            _db_initialized = True

    async with AsyncSessionLocal() as session:
        yield session
