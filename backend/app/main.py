"""Точка входа FastAPI: REST API + раздача статики (фронтенда).

Запуск:  uvicorn app.main:app --reload --port 8000  (из каталога backend/)
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope

from .config import settings
from .database import close_db, init_db
from .routes import auth, categories, services, users

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)

STATIC_DIR = Path(__file__).resolve().parent / "static"


class NoCacheStaticFiles(StaticFiles):
    """Статика без кеширования — браузер всегда берёт свежие JS/CSS.

    Для локального проекта в разработке это важнее, чем экономия трафика:
    иначе после правок фронтенда браузер показывает старую закешированную версию.
    """

    def is_not_modified(self, response_headers, request_headers) -> bool:  # noqa: ARG002
        return False  # отключаем ответы 304 Not Modified

    async def get_response(self, path: str, scope: Scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="Local Services Map",
    description="Системный поиск доступности локальных услуг с геолокацией",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # локальное приложение, всё на одном порту
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Авторизация"])
app.include_router(services.router, prefix="/api/services", tags=["Заведения"])
app.include_router(users.router, prefix="/api/users", tags=["Пользователь"])
app.include_router(categories.router, prefix="/api/categories", tags=["Категории"])


@app.get("/api/config", tags=["Конфигурация"])
async def get_config():
    """Публичная конфигурация для фронтенда (ключ тайлов не хардкодится в JS)."""
    return {
        "maptiler_api_key": settings.MAPTILER_API_KEY or None,
        "default_radius": 1000,
        "default_center": {"lat": 51.2465, "lng": 22.5684},  # Люблин
    }


app.mount("/static", NoCacheStaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(
        STATIC_DIR / "index.html",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )
