"""FastAPI entry point: REST API + serving the static frontend.

Run with:  uvicorn app.main:app --reload --port 8000  (from the backend/ directory)
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
from .routes import auth, categories, reviews, services, users

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)

STATIC_DIR = Path(__file__).resolve().parent / "static"


class NoCacheStaticFiles(StaticFiles):
    """Static files without caching — the browser always gets fresh JS/CSS.

    For a local project in development this matters more than saving bandwidth:
    otherwise, after frontend edits, the browser keeps showing a stale cached version.
    """

    def is_not_modified(self, response_headers, request_headers) -> bool:  # noqa: ARG002
        return False  # disable 304 Not Modified responses

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
    description="System for finding the availability of local services with geolocation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local app, everything served from one port
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(users.router, prefix="/api/users", tags=["User"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])


@app.get("/api/config", tags=["Configuration"])
async def get_config():
    """Public configuration for the frontend (the tile key is not hardcoded in JS)."""
    return {
        "maptiler_api_key": settings.MAPTILER_API_KEY or None,
        "default_radius": 1000,
        "default_center": {"lat": 51.2465, "lng": 22.5684},  # Lublin
    }


app.mount("/static", NoCacheStaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(
        STATIC_DIR / "index.html",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@app.get("/sw.js", include_in_schema=False)
async def service_worker():
    # served from the root so the service worker's scope covers the whole site
    return FileResponse(
        STATIC_DIR / "sw.js",
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Service-Worker-Allowed": "/",
        },
    )


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(STATIC_DIR / "icons" / "favicon.png")
