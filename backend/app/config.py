"""Настройки приложения. Значения читаются из backend/.env (python-dotenv)."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # каталог backend/
load_dotenv(BASE_DIR / ".env")


def _as_bool(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    # MongoDB
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "local_services_map")

    # JWT
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "insecure-dev-key-change-me-minimum-32-chars"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))

    # MapTiler (опционально — без ключа фронтенд переключается на тайлы OSM)
    MAPTILER_API_KEY: str = os.getenv("MAPTILER_API_KEY", "")

    # Кеширование Overpass
    CACHE_TTL_DAYS: int = int(os.getenv("CACHE_TTL_DAYS", "7"))

    DEBUG: bool = _as_bool(os.getenv("DEBUG", "true"))


settings = Settings()
