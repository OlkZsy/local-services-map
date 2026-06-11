"""JWT-токены, хеширование паролей и FastAPI-зависимости текущего пользователя."""

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from ..config import settings
from ..database import get_db

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer(auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Недействительный или отсутствующий токен",
    headers={"WWW-Authenticate": "Bearer"},
)


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def create_access_token(user_id: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expires}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def _resolve_user(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = ObjectId(payload["sub"])
    except (JWTError, KeyError, InvalidId):
        return None
    return await get_db().users.find_one({"_id": user_id})


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Обязательная авторизация: 401, если токена нет или он невалиден."""
    if credentials is None:
        raise _CREDENTIALS_ERROR
    user = await _resolve_user(credentials.credentials)
    if user is None:
        raise _CREDENTIALS_ERROR
    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict | None:
    """Необязательная авторизация: гость получает None вместо 401."""
    if credentials is None:
        return None
    return await _resolve_user(credentials.credentials)
