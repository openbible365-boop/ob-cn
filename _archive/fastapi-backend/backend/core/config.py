import os
from pydantic_settings import BaseSettings, SettingsConfigDict

from pydantic import Field, AliasChoices

class Settings(BaseSettings):
    PROJECT_NAME: str = "OpenBible API"
    
    # 优先读取 DATABASE_URL 或 POSTGRES_URL
    db_url: str = Field(
        default="sqlite+aiosqlite:///./backend/openbible.db",
        validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_URL")
    )
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    @property
    def DATABASE_URL(self) -> str:
        url = self.db_url
        if os.getenv("VERCEL"):
             print(f"DEBUG: Vercel detected. db_url exists: {bool(url)}, starts with: {url[:10] if url else 'None'}")
             # Vercel 只读环境降级：如果使用 SQLite 默认配置，强行修改为内存数据库 :memory:，避免只读文件系统无法写入导致服务 500 崩溃
             if not url or "sqlite" in url:
                 url = "sqlite+aiosqlite:///:memory:"
        # asyncpg doesn't support 'sslmode' parameter in URL
        if url and "sslmode=" in url:
            import urllib.parse
            parsed = urllib.parse.urlparse(url)
            query = urllib.parse.parse_qs(parsed.query)
            query.pop("sslmode", None)
            new_query = urllib.parse.urlencode(query, doseq=True)
            url = parsed._replace(query=new_query).geturl()
            
        if url and url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url and url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-please-change-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    # Gemini API Key
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    # n1n.ai 配置（OpenAI 兼容接口）
    N1N_API_KEY: str = os.getenv("N1N_API_KEY", "")
    N1N_API_BASE: str = os.getenv("N1N_API_BASE", "https://api.n1n.ai/v1")
    # 默认模型（其他场景备用）
    N1N_MODEL: str = os.getenv("N1N_MODEL", "gpt-4o-mini")
    # NOTE: 灭命阶段路由模型
    # 教牧人员 / 资深圣经教师 / 神学研究人员（level 5-6）→ Claude
    N1N_CLAUDE_MODEL: str = os.getenv("N1N_CLAUDE_MODEL", "claude-opus-4-5")
    # 其他信徒阶段（level 1-4）→ Grok
    N1N_GROK_MODEL: str = os.getenv("N1N_GROK_MODEL", "grok-3")

    # NOTE: 豆包 TTS（火山引擎语音合成）凭证
    # 在火山引擎控制台 → 语音技术 → 应用管理中获取
    DOUBAO_APP_ID: str = os.getenv("DOUBAO_APP_ID", "")
    DOUBAO_ACCESS_TOKEN: str = os.getenv("DOUBAO_ACCESS_TOKEN", "")
    # Cluster ID：语音合成服务集群，默认 volcano_tts（大模型 TTS 填 volcano_mega）
    DOUBAO_CLUSTER: str = os.getenv("DOUBAO_CLUSTER", "volcano_tts")
    # 声音 ID：开朗学长
    DOUBAO_VOICE_TYPE: str = os.getenv("DOUBAO_VOICE_TYPE", "en_male_jason_conversation_wvae_bigtts")
    # NOTE: 首页默认播放声音，'female'=知性女声（新约默认），'male'=开朗学长（旧约默认）
    # 旧约始终使用 male，此设置影响新约的默认选择
    TTS_DEFAULT_VOICE: str = os.getenv("TTS_DEFAULT_VOICE", "female")

    # NOTE: Claude 配置（Anthropic API，用于教牧人员/资深圣经教师/神学研究人员）
    # 获取地址：https://console.anthropic.com
    CLAUDE_API_KEY: str = os.getenv("CLAUDE_API_KEY", "")
    CLAUDE_API_BASE: str = os.getenv("CLAUDE_API_BASE", "https://api.anthropic.com/v1")
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-opus-4-5")

    # NOTE: Grok 配置（xAI API，用于一般信徒/研读者）
    # 获取地址：https://console.x.ai
    GROK_API_KEY: str = os.getenv("GROK_API_KEY", "")
    GROK_API_BASE: str = os.getenv("GROK_API_BASE", "https://api.x.ai/v1")
    GROK_MODEL: str = os.getenv("GROK_MODEL", "grok-3")

    # NOTE: AWS S3 配置（用于存储 TTS 合成音频，替代本地文件系统）
    # 在 AWS Console → IAM → 创建具有 s3:PutObject / s3:GetObject 权限的用户
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "")
    AWS_S3_REGION: str = os.getenv("AWS_S3_REGION", "us-east-1")

    # NOTE: Stripe 支付配置
    STRIPE_API_KEY: str = os.getenv("STRIPE_API_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()

# 安全校验：生产环境(DEBUG=False)若仍使用内置默认 SECRET_KEY，拒绝启动，
# 防止因忘记注入密钥而导致 JWT 可被任意伪造。
_INSECURE_SECRET = "dev-secret-key-please-change-in-prod"
if not settings.DEBUG and settings.SECRET_KEY == _INSECURE_SECRET:
    raise RuntimeError(
        "SECRET_KEY 仍为不安全的默认值，生产环境(DEBUG=False)必须通过环境变量注入一个强随机 SECRET_KEY。"
    )
