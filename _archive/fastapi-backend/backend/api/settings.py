"""
系统设置 API — 允许管理员通过后台页面读写 n1n.ai 配置。
设置持久化到项目根目录的 .env 文件，uvicorn --reload 会自动热重载。
"""

import os
import pathlib
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from backend.api.deps import get_current_admin
from backend.model.user import User
from backend.core.config import settings

router = APIRouter(prefix="/api/admin/settings", tags=["settings"])
# NOTE: 公开配置路由，无需登录鉴权
public_router = APIRouter(prefix="/api/config", tags=["config"])

# 项目根目录（backend/api/settings.py → 上两级）
ROOT_DIR = pathlib.Path(__file__).parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"


class N1NSettings(BaseModel):
    n1n_api_key: Optional[str] = None     # 留空表示不修改
    n1n_api_base: str = "https://api.n1n.ai/v1"
    n1n_model: str = "gpt-4o-mini"
    tts_default_voice: str = "female"     # 首页新约默认声音


class N1NSettingsResponse(BaseModel):
    # NOTE: key 脱敏后返回，不暴露明文
    n1n_api_key_masked: str
    n1n_api_base: str
    n1n_model: str
    has_key: bool
    tts_default_voice: str               # 首页新约默认声音


def _mask_key(key: str) -> str:
    """脱敏 API Key，只保留前 8 字符 + ***"""
    if not key or key.startswith("请填写"):
        return ""
    if len(key) <= 8:
        return "***"
    return key[:8] + "***"


def _update_env_file(updates: dict[str, str]) -> None:
    """
    读取 .env 文件，更新指定 key 的值（如果不存在则追加）。
    保持文件中其他行不变。
    """
    # 安全：清洗值中的换行/回车，防止某个配置值里夹带 "\n KEY=..." 注入额外 env 行（如覆盖 SECRET_KEY）
    updates = {k: ("" if v is None else str(v)).replace("\r", "").replace("\n", "") for k, v in updates.items()}

    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()

    updated_keys: set[str] = set()
    new_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        # 跳过注释行和空行
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        if "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}")
                updated_keys.add(key)
                continue
        new_lines.append(line)

    # 追加新 key（原文件中没有的）
    for key, val in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={val}")

    ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


@router.get("", response_model=N1NSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_admin)
):
    """获取当前系统配置（Key 脱敏）"""
    key = settings.N1N_API_KEY
    return N1NSettingsResponse(
        n1n_api_key_masked=_mask_key(key),
        n1n_api_base=settings.N1N_API_BASE,
        n1n_model=settings.N1N_MODEL,
        has_key=bool(key and not key.startswith("请填写")),
        tts_default_voice=settings.TTS_DEFAULT_VOICE,
    )


@router.put("", response_model=N1NSettingsResponse)
async def update_settings(
    payload: N1NSettings,
    current_user: User = Depends(get_current_admin)
):
    """
    更新 n1n.ai 配置到 .env 文件。
    - n1n_api_key 为空时，保持原有 Key 不变
    - 更新后 uvicorn --reload 会自动热重载，新配置立即生效
    """
    updates: dict[str, str] = {
        "N1N_API_BASE": payload.n1n_api_base,
        "N1N_MODEL": payload.n1n_model,
        "TTS_DEFAULT_VOICE": payload.tts_default_voice,
    }
    # NOTE: 只有用户明确传入了 Key 才更新，防止误清空
    if payload.n1n_api_key and payload.n1n_api_key.strip():
        updates["N1N_API_KEY"] = payload.n1n_api_key.strip()

    _update_env_file(updates)

    # 更新运行时配置
    if "N1N_API_BASE" in updates:
        settings.N1N_API_BASE = updates["N1N_API_BASE"]
    if "N1N_MODEL" in updates:
        settings.N1N_MODEL = updates["N1N_MODEL"]
    if "N1N_API_KEY" in updates:
        settings.N1N_API_KEY = updates["N1N_API_KEY"]
    settings.TTS_DEFAULT_VOICE = payload.tts_default_voice

    key = settings.N1N_API_KEY
    return N1NSettingsResponse(
        n1n_api_key_masked=_mask_key(key),
        n1n_api_base=settings.N1N_API_BASE,
        n1n_model=settings.N1N_MODEL,
        has_key=bool(key and not key.startswith("请填写")),
        tts_default_voice=settings.TTS_DEFAULT_VOICE,
    )

@public_router.get("/voice")
async def get_public_voice_config():
    """
    公开接口：返回后台配置的新约默认声音。
    前端「收听」功能用此值，不在播放器上展示切换按钮。
    """
    return {"nt_voice": settings.TTS_DEFAULT_VOICE or "female"}
