from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import VM
from ..schemas.storage import ComputePoint

router = APIRouter(prefix="/compute", tags=["compute"])

GB = 1024 ** 3


@router.get("/trend", response_model=list[ComputePoint])
async def compute_trend(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = datetime.fromisoformat(end_date) if end_date else datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(
                cast(VM.zstack_created_at, Date).label("day"),
                func.sum(VM.vcpu_num).label("vcpu"),
                func.sum(VM.memory_size).label("mem"),
            )
            .where(VM.zstack_created_at >= since, VM.zstack_created_at <= until)
            .group_by("day")
            .order_by("day")
        )
    ).all()
    return [
        ComputePoint(date=str(r.day), vcpu=int(r.vcpu or 0), ram_gb=round((r.mem or 0) / GB, 1))
        for r in rows
    ]
