from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.alert import AlertChannel, AlertRule
from ..schemas.alert import (
    AlertChannelCreate, AlertChannelOut, AlertChannelUpdate,
    AlertRuleOut, AlertRuleUpdate,
    AlertTestResult,
)
from ..services.alert_service import test_channel

router = APIRouter(prefix="/alerts", tags=["alerts"])

# Default rules seeded when a new channel is created
_DEFAULT_RULES = [
    {"module": "disk_health", "level": "WARNING",  "interval_hours": 24.0},
    {"module": "disk_health", "level": "MAJOR",    "interval_hours": 12.0},
    {"module": "disk_health", "level": "CRITICAL", "interval_hours": 1.0},
]


# ─── Channels ────────────────────────────────────────────────────────────────

@router.get("/channels", response_model=list[AlertChannelOut])
async def list_channels(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AlertChannel).order_by(AlertChannel.created_at))).scalars().all()
    return rows


@router.post("/channels", response_model=AlertChannelOut, status_code=status.HTTP_201_CREATED)
async def create_channel(body: AlertChannelCreate, db: AsyncSession = Depends(get_db)):
    channel = AlertChannel(
        name=body.name,
        channel_type=body.channel_type,
        webhook_url=body.webhook_url,
        enabled=body.enabled,
    )
    db.add(channel)
    await db.flush()  # populate channel.id

    # Auto-seed default rules
    for rule_def in _DEFAULT_RULES:
        rule = AlertRule(
            channel_id=channel.id,
            module=rule_def["module"],
            level=rule_def["level"],
            interval_hours=rule_def["interval_hours"],
            enabled=True,
        )
        db.add(rule)

    await db.commit()
    await db.refresh(channel)
    return channel


@router.patch("/channels/{channel_id}", response_model=AlertChannelOut)
async def update_channel(
    channel_id: str, body: AlertChannelUpdate, db: AsyncSession = Depends(get_db)
):
    channel = (
        await db.execute(select(AlertChannel).where(AlertChannel.id == channel_id))
    ).scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if body.name is not None:
        channel.name = body.name
    if body.webhook_url is not None:
        channel.webhook_url = body.webhook_url
    if body.enabled is not None:
        channel.enabled = body.enabled
    await db.commit()
    await db.refresh(channel)
    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(channel_id: str, db: AsyncSession = Depends(get_db)):
    channel = (
        await db.execute(select(AlertChannel).where(AlertChannel.id == channel_id))
    ).scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.delete(channel)
    await db.commit()


# ─── Rules ───────────────────────────────────────────────────────────────────

@router.get("/channels/{channel_id}/rules", response_model=list[AlertRuleOut])
async def list_rules(channel_id: str, db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(AlertRule)
            .where(AlertRule.channel_id == channel_id)
            .order_by(AlertRule.level)
        )
    ).scalars().all()
    return rows


@router.patch("/rules/{rule_id}", response_model=AlertRuleOut)
async def update_rule(rule_id: str, body: AlertRuleUpdate, db: AsyncSession = Depends(get_db)):
    rule = (
        await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if body.interval_hours is not None:
        rule.interval_hours = body.interval_hours
    if body.enabled is not None:
        rule.enabled = body.enabled
    await db.commit()
    await db.refresh(rule)
    return rule


# ─── Test ─────────────────────────────────────────────────────────────────────

@router.post("/channels/{channel_id}/test", response_model=AlertTestResult)
async def test_channel_endpoint(channel_id: str, db: AsyncSession = Depends(get_db)):
    return await test_channel(db, channel_id)
