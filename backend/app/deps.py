import uuid
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .security import get_current_user
from .models.user import AppUser
from .models.user_scope import UserProjectScope, UserResourceGroupScope
from .models.resource_group import ResourceGroupProject


async def get_allowed_project_ids(
    current_user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> set[uuid.UUID] | None:
    """Return None for unrestricted access, or the set of project UUIDs the user may see."""
    if current_user.role == "Admin" or current_user.scope_type == "global":
        return None

    if current_user.scope_type == "project":
        rows = (await db.execute(
            select(UserProjectScope.project_id)
            .where(UserProjectScope.user_id == current_user.id)
        )).all()
        return {r[0] for r in rows}

    if current_user.scope_type == "resource_group":
        rows = (await db.execute(
            select(ResourceGroupProject.project_id)
            .join(
                UserResourceGroupScope,
                UserResourceGroupScope.resource_group_id == ResourceGroupProject.resource_group_id,
            )
            .where(UserResourceGroupScope.user_id == current_user.id)
        )).all()
        return {r[0] for r in rows}

    return set()
