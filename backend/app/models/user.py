"""Pydantic-схемы пользователя и авторизации."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserSettings(BaseModel):
    default_radius: int = Field(default=1000, ge=500, le=5000)
    language: Literal["pl", "ru", "en"] = "pl"
    theme: Literal["light", "dark"] = "light"


class UserSettingsUpdate(BaseModel):
    """Частичное обновление настроек (PATCH)."""

    default_radius: int | None = Field(default=None, ge=500, le=5000)
    language: Literal["pl", "ru", "en"] | None = None
    theme: Literal["light", "dark"] | None = None


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    username: str
    created_at: datetime
    settings: UserSettings


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
