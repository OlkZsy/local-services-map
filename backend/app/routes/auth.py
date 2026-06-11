"""Маршруты авторизации: /api/auth/*"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_db
from ..models.user import Token, UserCreate, UserLogin, UserOut, UserSettings
from ..services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter()


def _to_user_out(user: dict) -> UserOut:
    return UserOut(
        id=str(user["_id"]),
        email=user["email"],
        username=user["username"],
        created_at=user["created_at"],
        settings=UserSettings(**user.get("settings", {})),
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate):
    db = get_db()
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    now = datetime.now(timezone.utc)
    user = {
        "email": data.email,
        "username": data.username,
        "password_hash": hash_password(data.password),
        "created_at": now,
        "last_login": now,
        "settings": UserSettings().model_dump(),
    }
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    return _to_user_out(user)


@router.post("/login", response_model=Token)
async def login(data: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": data.email})
    if user is None or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )
    return Token(access_token=create_access_token(str(user["_id"])))


@router.post("/logout")
async def logout():
    # JWT не хранит состояние на сервере — клиент просто удаляет токен.
    return {"message": "Выход выполнен"}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _to_user_out(user)
