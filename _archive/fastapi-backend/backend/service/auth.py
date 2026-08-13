from datetime import datetime, timedelta
from typing import Any, Union
import bcrypt
from jose import jwt
from google.oauth2 import id_token
from google.auth.transport import requests
from backend.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

class _TimeoutRequest(requests.Request):
    """给 Google 取证书的 HTTP 调用加默认超时（原默认 120s，过长易挂起）。"""
    def __call__(self, *args, **kwargs):
        kwargs.setdefault("timeout", 10)
        return super().__call__(*args, **kwargs)


def verify_google_token(token: str) -> Union[dict, None]:
    """
    验证 Google 登录返回的 credential JWT Token
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            token, _TimeoutRequest(), settings.GOOGLE_CLIENT_ID
        )
        return idinfo
    except ValueError:
        # Invalid token
        return None
    except Exception as e:
        # 网络/超时等异常：不抛 500，按校验失败处理
        import logging
        logging.getLogger(__name__).warning(f"Google token verify failed (network/timeout?): {e}")
        return None
