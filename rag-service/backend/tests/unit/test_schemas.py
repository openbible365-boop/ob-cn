"""Pydantic schema 校验测试。"""

import pytest
from pydantic import ValidationError

from app.schemas import (
    UserCreate,
    UserUpdate,
)


# ---- UserCreate ----
def test_user_create_ok():
    u = UserCreate(email="a@b.com", password="12345678")
    assert u.email == "a@b.com"


def test_user_create_password_too_short():
    with pytest.raises(ValidationError):
        UserCreate(email="a@b.com", password="short")


def test_user_create_bad_email():
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email", password="12345678")


# ---- UserUpdate ----
def test_user_update_empty_rejected():
    with pytest.raises(ValidationError):
        UserUpdate()


def test_user_update_role_only_ok():
    u = UserUpdate(role="user")
    assert u.role.value == "user"


def test_user_update_active_only_ok():
    u = UserUpdate(is_active=False)
    assert u.is_active is False


def test_user_update_bad_role():
    with pytest.raises(ValidationError):
        UserUpdate(role="superuser")
