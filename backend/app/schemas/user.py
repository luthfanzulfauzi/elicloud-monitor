from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Literal

UserRole = Literal["Admin", "Operator", "Viewer"]
UserStatus = Literal["Active", "Inactive"]

APP_MODULES = [
    "Dashboard", "Hosts", "VMs", "Storage", "Projects",
    "Resource Groups", "Reports", "User Management",
]

# Modules that Operator cannot manage
_OP_NO_MANAGE = {"Dashboard", "Reports", "User Management"}
# Modules hidden from non-Admin roles entirely
_ADMIN_ONLY = {"User Management"}


def default_permissions(role: UserRole) -> dict:
    perms = {}
    for mod in APP_MODULES:
        if role == "Admin":
            perms[mod] = {"view": True, "manage": True}
        elif role == "Operator":
            perms[mod] = {
                "view": mod not in _ADMIN_ONLY,
                "manage": mod not in _OP_NO_MANAGE and mod not in _ADMIN_ONLY,
            }
        else:  # Viewer
            perms[mod] = {"view": mod not in _ADMIN_ONLY, "manage": False}
    return perms


class AppUserCreate(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    status: UserStatus = "Active"
    password: str | None = None


class AppUserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    status: UserStatus | None = None
    password: str | None = None


class AppUserPermissionsUpdate(BaseModel):
    permissions: dict


class AppUserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    email: str
    role: str
    status: str
    permissions: dict
    created_at: datetime
    last_login: datetime | None
    last_active_at: datetime | None
