"""
alert_service.py — Disk health alerting via Google Chat webhooks.

Mirrors the frontend effectiveLevel() logic exactly so alert severity
is consistent with what users see in the DiskHealth page.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.alert import AlertChannel, AlertRule, AlertState
from ..models.ceph_osd import CephOsdRecord
from ..models.disk_health import DiskHealthRecord
from ..models.osd_mapping import OsdMapping
from ..schemas.alert import AlertTestResult

log = logging.getLogger(__name__)


@dataclass
class _DummyDisk:
    """Lightweight stand-in for DiskHealthRecord used only in test alerts."""
    hostname: str
    nvme_device: str
    disk_health: str
    summary: str | None
    notes: str | None
    available_spare_pct: float | None = None


# ─── Level computation ────────────────────────────────────────────────────────

LEVEL_ORDER = {"GOOD": 0, "WARNING": 1, "MAJOR": 2, "CRITICAL": 3}


def compute_disk_effective_level(disk: DiskHealthRecord, ceph_utilization: float | None) -> str:
    """Mirror the frontend effectiveLevel() function exactly."""
    util = ceph_utilization or 0.0

    if disk.disk_health == "FAILED":
        return "CRITICAL"
    if disk.summary == "Not good":
        return "CRITICAL"
    if util >= 85:
        return "CRITICAL"
    if util >= 80:
        return "MAJOR"
    if disk.summary == "Warning":
        return "WARNING"
    if util >= 70:
        return "WARNING"
    return "GOOD"


def _disk_reason(disk: DiskHealthRecord, ceph_utilization: float | None) -> str:
    """Build a human-readable reason string for the alert message."""
    parts: list[str] = []
    # Skip the default "all good" SMART note — it adds noise when Ceph is the trigger
    if disk.notes and disk.notes != "All indicators nominal":
        parts.append(disk.notes)
    util = ceph_utilization or 0.0
    if util >= 70:
        parts.append(f"Ceph Use {util:.1f}%")
    return "; ".join(parts) if parts else "—"


# ─── Google Chat ──────────────────────────────────────────────────────────────

async def send_google_chat(webhook_url: str, text: str) -> bool:
    """POST a text message to a Google Chat Space webhook. Returns True on success."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(webhook_url, json={"text": text})
            resp.raise_for_status()
            return True
    except Exception as exc:
        log.error("Google Chat webhook POST failed: %s", exc)
        return False


# ─── Message formatting ───────────────────────────────────────────────────────

def format_disk_alert_message(
    alerts_by_level: dict[str, list[tuple[DiskHealthRecord, float | None]]],
    test: bool = False,
) -> str:
    """Format a grouped alert message for Google Chat."""
    now_str = datetime.now(ZoneInfo("Asia/Jakarta")).strftime("%Y-%m-%d %H:%M WIB")

    header = "🧪 *[TEST] Disk Health Alert — EliCloud Monitor*" if test else "🚨 *Disk Health Alert — EliCloud Monitor*"
    lines: list[str] = [header, ""]

    level_config = [
        ("CRITICAL", "🔴"),
        ("MAJOR", "🟠"),
        ("WARNING", "⚠️"),
    ]

    for level, emoji in level_config:
        items = alerts_by_level.get(level, [])
        if not items:
            continue
        # Sort: highest Ceph Use first, then lowest Available Spare first
        items_sorted = sorted(
            items,
            key=lambda x: (-(x[1] or 0.0), x[0].available_spare_pct or 100.0),
        )
        lines.append(f"{emoji} *{level} ({len(items_sorted)} disk(s))*")
        for disk, ceph_util in items_sorted:
            reason = _disk_reason(disk, ceph_util)
            lines.append(f"• `{disk.hostname}` / {disk.nvme_device} — {reason}")
        lines.append("")

    lines.append(f"_Checked at {now_str}_")
    return "\n".join(lines)


# ─── Main check ──────────────────────────────────────────────────────────────

async def check_disk_health_alerts(db: AsyncSession) -> int:
    """
    Run one alert check cycle.
    Returns the total number of alert notifications sent.
    """
    now = datetime.now(timezone.utc)

    # 1. Load enabled channels
    channels = (
        await db.execute(select(AlertChannel).where(AlertChannel.enabled.is_(True)))
    ).scalars().all()
    if not channels:
        return 0

    # 2. Load all non-missing disk records
    disks = (
        await db.execute(
            select(DiskHealthRecord).where(DiskHealthRecord.is_missing.is_(False))
        )
    ).scalars().all()
    if not disks:
        return 0

    # 3. Build OSD lookup: hostname::nvme_device → osd_id
    osd_map_rows = (await db.execute(select(OsdMapping))).scalars().all()
    osd_id_by_key: dict[str, int] = {}
    for om in osd_map_rows:
        if om.osd_id is not None:
            osd_id_by_key[f"{om.hostname}::{om.nvme_device}"] = om.osd_id

    # 4. Build CephOsdRecord lookup: osd_id → utilization
    ceph_rows = (await db.execute(select(CephOsdRecord))).scalars().all()
    util_by_osd: dict[int, float] = {r.osd_id: (r.utilization or 0.0) for r in ceph_rows}

    # 5. Compute effective level for each disk
    disk_levels: list[tuple[DiskHealthRecord, str, float | None]] = []
    for disk in disks:
        key = f"{disk.hostname}::{disk.nvme_device}"
        osd_id = osd_id_by_key.get(key)
        ceph_util = util_by_osd.get(osd_id) if osd_id is not None else None
        level = compute_disk_effective_level(disk, ceph_util)
        if level != "GOOD":
            disk_levels.append((disk, level, ceph_util))

    if not disk_levels:
        return 0

    total_sent = 0

    for channel in channels:
        # 6. Load rules for this channel
        rules_rows = (
            await db.execute(
                select(AlertRule).where(
                    AlertRule.channel_id == channel.id,
                    AlertRule.module == "disk_health",
                    AlertRule.enabled.is_(True),
                )
            )
        ).scalars().all()
        interval_by_level: dict[str, float] = {r.level: r.interval_hours for r in rules_rows}
        if not interval_by_level:
            continue

        # 7. Load existing alert states for this channel
        state_rows = (
            await db.execute(
                select(AlertState).where(
                    AlertState.channel_id == channel.id,
                    AlertState.module == "disk_health",
                )
            )
        ).scalars().all()
        # key: (item_key, level) → AlertState
        state_map: dict[tuple[str, str], AlertState] = {
            (s.item_key, s.level): s for s in state_rows
        }

        # 8. Determine which alerts to send
        alerts_to_send: list[tuple[DiskHealthRecord, str, float | None]] = []
        for disk, level, ceph_util in disk_levels:
            interval_h = interval_by_level.get(level)
            if interval_h is None:
                continue  # no rule for this level on this channel
            item_key = f"{disk.hostname}::{disk.nvme_device}"
            state = state_map.get((item_key, level))
            if state is not None:
                elapsed_h = (now - state.last_alerted_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
                if elapsed_h < interval_h:
                    continue  # not due yet
            alerts_to_send.append((disk, level, ceph_util))

        if not alerts_to_send:
            continue

        # 9. Group by level and send ONE message per channel
        alerts_by_level: dict[str, list[tuple[DiskHealthRecord, float | None]]] = {}
        for disk, level, ceph_util in alerts_to_send:
            alerts_by_level.setdefault(level, []).append((disk, ceph_util))

        message = format_disk_alert_message(alerts_by_level)
        success = await send_google_chat(channel.webhook_url, message)
        if not success:
            log.warning("Failed to send alert to channel '%s' (%s)", channel.name, channel.id)
            continue

        total_sent += 1

        # 10. Upsert alert_state for every sent item
        for disk, level, _ceph_util in alerts_to_send:
            item_key = f"{disk.hostname}::{disk.nvme_device}"
            existing = state_map.get((item_key, level))
            stmt = pg_insert(AlertState).values(
                channel_id=channel.id,
                module="disk_health",
                item_key=item_key,
                level=level,
                last_alerted_at=now,
                first_alerted_at=existing.first_alerted_at if existing else now,
                alert_count=(existing.alert_count + 1) if existing else 1,
            ).on_conflict_do_update(
                index_elements=None,
                constraint="uq_alert_state_channel_module_item_level",
                set_={
                    "last_alerted_at": now,
                    "alert_count": AlertState.alert_count + 1,
                },
            )
            await db.execute(stmt)

        await db.commit()

    return total_sent


# ─── Test channel ─────────────────────────────────────────────────────────────

async def test_channel(db: AsyncSession, channel_id: str) -> AlertTestResult:
    """Send a connectivity test message to the given channel."""
    channel = (
        await db.execute(select(AlertChannel).where(AlertChannel.id == channel_id))
    ).scalar_one_or_none()
    if not channel:
        return AlertTestResult(success=False, message="Channel not found")

    text = "✅ *EliCloud Monitor — Alert Test*\nWebhook is working correctly."
    ok = await send_google_chat(channel.webhook_url, text)
    if ok:
        return AlertTestResult(success=True, message="Test message sent successfully.")
    return AlertTestResult(success=False, message="Failed to deliver test message — check webhook URL.")


_DUMMY_DISKS: dict[str, list[tuple[_DummyDisk, float | None]]] = {
    "WARNING": [
        (_DummyDisk("zs-storage-demo", "nvme0n1", "PASSED", "Warning",  "Available Spare 85%",   85.0),  None),
        (_DummyDisk("zs-storage-demo", "nvme2n1", "PASSED", "Good",     None,                    100.0), 71.5),
    ],
    "MAJOR": [
        (_DummyDisk("zs-storage-demo", "nvme0n1", "PASSED", "Good",     None,                    100.0), 82.3),
        (_DummyDisk("zs-storage-demo", "nvme4n1", "PASSED", "Good",     None,                    100.0), 81.0),
    ],
    "CRITICAL": [
        (_DummyDisk("zs-storage-demo", "nvme0n1", "FAILED", "Not good", "SMART health FAILED",   0.0),   None),
        (_DummyDisk("zs-storage-demo", "nvme1n1", "PASSED", "Good",     None,                    100.0), 87.5),
    ],
}


async def test_level_alert(db: AsyncSession, channel_id: str, level: str) -> AlertTestResult:
    """
    Send a test alert for a specific level, bypassing interval state.
    Uses real disk data if available; falls back to dummy data with a note.
    """
    level = level.upper()
    if level not in ("WARNING", "MAJOR", "CRITICAL"):
        return AlertTestResult(success=False, message=f"Invalid level: {level}")

    channel = (
        await db.execute(select(AlertChannel).where(AlertChannel.id == channel_id))
    ).scalar_one_or_none()
    if not channel:
        return AlertTestResult(success=False, message="Channel not found")

    # Build disk + Ceph lookups
    disks = (
        await db.execute(select(DiskHealthRecord).where(DiskHealthRecord.is_missing.is_(False)))
    ).scalars().all()
    osd_map_rows = (await db.execute(select(OsdMapping))).scalars().all()
    osd_id_by_key: dict[str, int] = {
        f"{om.hostname}::{om.nvme_device}": om.osd_id
        for om in osd_map_rows if om.osd_id is not None
    }
    ceph_rows = (await db.execute(select(CephOsdRecord))).scalars().all()
    util_by_osd: dict[int, float] = {r.osd_id: (r.utilization or 0.0) for r in ceph_rows}

    # Filter to disks at the requested level
    matching: list[tuple[DiskHealthRecord, float | None]] = []
    for disk in disks:
        key = f"{disk.hostname}::{disk.nvme_device}"
        osd_id = osd_id_by_key.get(key)
        ceph_util = util_by_osd.get(osd_id) if osd_id is not None else None
        if compute_disk_effective_level(disk, ceph_util) == level:
            matching.append((disk, ceph_util))

    is_dummy = not matching
    if is_dummy:
        matching = _DUMMY_DISKS[level]  # type: ignore[assignment]

    alerts_by_level = {level: matching}
    message = format_disk_alert_message(alerts_by_level, test=True)
    if is_dummy:
        message += "\n\n_⚠️ No real disks currently at this level — dummy data shown for format preview._"

    ok = await send_google_chat(channel.webhook_url, message)
    if ok:
        suffix = " (dummy data)" if is_dummy else f" ({len(matching)} disk(s))"
        return AlertTestResult(success=True, message=f"Test {level} alert sent{suffix}.")
    return AlertTestResult(success=False, message="Failed to deliver test message — check webhook URL.")
