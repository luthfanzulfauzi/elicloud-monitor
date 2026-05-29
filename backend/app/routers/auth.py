from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.user import AppUser
from ..schemas.user import AppUserOut
from ..security import ACCESS_TOKEN_EXPIRE_HOURS, create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AppUserOut


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppUser).where(AppUser.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.status != "Active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    return LoginResponse(
        access_token=create_access_token(str(user.id)),
        expires_in=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        user=AppUserOut.model_validate(user),
    )


@router.get("/me", response_model=AppUserOut)
async def me(
    current_user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.last_active_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(current_user)
    return current_user
