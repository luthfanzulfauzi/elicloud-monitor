from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import AppUser
from ..schemas.user import AppUserCreate, AppUserUpdate, AppUserPermissionsUpdate, AppUserOut, default_permissions
from ..security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[AppUserOut])
async def list_users(db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(AppUser).order_by(AppUser.created_at))).scalars().all()
    return users


@router.post("", response_model=AppUserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: AppUserCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(AppUser).where(AppUser.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = AppUser(
        name=body.name,
        email=body.email,
        role=body.role,
        status=body.status,
        password_hash=hash_password(body.password) if body.password else None,
        permissions=default_permissions(body.role),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=AppUserOut)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(AppUser).where(AppUser.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=AppUserOut)
async def update_user(user_id: str, body: AppUserUpdate, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(AppUser).where(AppUser.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.name is not None:
        user.name = body.name
    if body.email is not None:
        user.email = body.email
    if body.role is not None:
        user.role = body.role
        user.permissions = default_permissions(body.role)
    if body.status is not None:
        user.status = body.status
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}/permissions", response_model=AppUserOut)
async def update_permissions(user_id: str, body: AppUserPermissionsUpdate, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(AppUser).where(AppUser.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "Admin":
        raise HTTPException(status_code=400, detail="Admin permissions are non-editable")
    user.permissions = body.permissions
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(AppUser).where(AppUser.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
