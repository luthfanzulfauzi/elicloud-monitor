import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.disk_health import DiskHealthRecord

log = logging.getLogger(__name__)


@dataclass
class CollectResult:
    nodes_collected: int
    nodes_failed: int
    files_parsed: int
    parse_errors: int


_FILENAME_RE = re.compile(r'^(.+?)_(nvme\d+n\d+)_smart$')


def _parse_file(path: Path) -> dict | None:
    stem = path.stem
    m = _FILENAME_RE.match(stem)
    if not m:
        log.warning("Skipping unrecognised filename: %s", path.name)
        return None

    hostname = m.group(1)
    nvme_device = m.group(2)
    raw = path.read_text(errors="replace")

    def _field(label: str) -> str | None:
        pattern = re.compile(rf'^{re.escape(label)}:\s*(.+)$', re.MULTILINE)
        match = pattern.search(raw)
        return match.group(1).strip() if match else None

    model_number = _field("Model Number")

    # Capacity: prefer Total NVM Capacity, fall back to Namespace 1 Size/Capacity
    cap_raw = _field("Total NVM Capacity") or _field("Namespace 1 Size/Capacity")
    capacity_bytes: int | None = None
    if cap_raw:
        num_match = re.match(r'^[\d,]+', cap_raw.replace(' ', ''))
        if num_match:
            try:
                capacity_bytes = int(num_match.group(0).replace(',', ''))
            except ValueError:
                capacity_bytes = None

    # TBW: bracket value of Data Units Written, e.g. [528 TB] or [63.2 GB]
    tbw: float | None = None
    duw = _field("Data Units Written")
    if duw:
        bracket = re.search(r'\[([^\]]+)\]', duw)
        if bracket:
            bval = bracket.group(1).strip()
            num_match = re.match(r'([\d.]+)\s*(TB|GB)', bval, re.IGNORECASE)
            if num_match:
                val = float(num_match.group(1))
                unit = num_match.group(2).upper()
                tbw = val if unit == "TB" else val / 1000.0

    def _pct_field(label: str) -> float | None:
        raw_val = _field(label)
        if raw_val is None:
            return None
        try:
            return float(raw_val.rstrip('%').strip())
        except ValueError:
            return None

    endurance_used_pct = _pct_field("Percentage Used")
    life_remaining_pct = (100.0 - endurance_used_pct) if endurance_used_pct is not None else None
    available_spare_pct = _pct_field("Available Spare")
    spare_threshold_pct = _pct_field("Available Spare Threshold")

    critical_warning = _field("Critical Warning")

    media_errors: int | None = None
    me_raw = _field("Media and Data Integrity Errors")
    if me_raw is not None:
        try:
            media_errors = int(me_raw.replace(',', '').strip())
        except ValueError:
            media_errors = None

    # SMART overall health — first occurrence only
    health_match = re.search(
        r'^SMART overall-health self-assessment test result:\s*(\S+)',
        raw, re.MULTILINE
    )
    disk_health = health_match.group(1).upper() if health_match else "UNKNOWN"

    # Summary logic
    issues: list[str] = []
    warnings: list[str] = []

    if disk_health == "FAILED":
        issues.append("SMART health FAILED")
    if critical_warning and critical_warning != "0x00":
        issues.append(f"Critical Warning {critical_warning}")
    if available_spare_pct is not None and spare_threshold_pct is not None and available_spare_pct <= spare_threshold_pct:
        issues.append(f"Available Spare {available_spare_pct:.0f}% at or below threshold {spare_threshold_pct:.0f}%")
    if endurance_used_pct is not None and endurance_used_pct >= 100:
        issues.append(f"Percentage Used {endurance_used_pct:.0f}%")
    if media_errors is not None and media_errors > 0:
        issues.append(f"Media and Data Integrity Errors: {media_errors}")

    if issues:
        summary = "Not good"
        notes = "; ".join(issues)
    elif disk_health == "PASSED" and (
        (available_spare_pct is not None and available_spare_pct < 90)
        or (endurance_used_pct is not None and endurance_used_pct >= 70)
    ):
        if available_spare_pct is not None and available_spare_pct < 90:
            warnings.append(f"Available Spare {available_spare_pct:.0f}%")
        if endurance_used_pct is not None and endurance_used_pct >= 70:
            warnings.append(f"Percentage Used {endurance_used_pct:.0f}%")
        summary = "Warning"
        notes = "; ".join(warnings)
    else:
        summary = "Good"
        notes = "All indicators nominal"

    return {
        "hostname": hostname,
        "nvme_device": nvme_device,
        "model_number": model_number,
        "capacity_bytes": capacity_bytes,
        "tbw": tbw,
        "endurance_used_pct": endurance_used_pct,
        "life_remaining_pct": life_remaining_pct,
        "available_spare_pct": available_spare_pct,
        "disk_health": disk_health,
        "summary": summary,
        "notes": notes,
        "raw_output": raw,
        "collected_at": datetime.now(timezone.utc),
    }


async def parse_and_upsert_all(db: AsyncSession) -> tuple[int, int]:
    smartctl_dir = Path(settings.SMARTCTL_DIR)
    if not smartctl_dir.exists():
        log.warning("SMARTCTL_DIR does not exist: %s", smartctl_dir)
        return 0, 0

    files = list(smartctl_dir.glob("*_smart.txt"))
    if not files:
        log.info("No smartctl files found in %s", smartctl_dir)
        return 0, 0

    parsed = 0
    errors = 0
    now = datetime.now(timezone.utc)
    # Track which devices were seen per hostname in this collection run
    seen: dict[str, set[str]] = {}  # hostname → {nvme_device, ...}

    for path in files:
        try:
            record = _parse_file(path)
            if record is None:
                errors += 1
                continue

            seen.setdefault(record["hostname"], set()).add(record["nvme_device"])

            stmt = (
                pg_insert(DiskHealthRecord)
                .values(**record, is_missing=False, missing_since=None)
                .on_conflict_do_update(
                    constraint="uq_disk_health_hostname_device",
                    set_={
                        "model_number": record["model_number"],
                        "capacity_bytes": record["capacity_bytes"],
                        "tbw": record["tbw"],
                        "endurance_used_pct": record["endurance_used_pct"],
                        "life_remaining_pct": record["life_remaining_pct"],
                        "available_spare_pct": record["available_spare_pct"],
                        "disk_health": record["disk_health"],
                        "summary": record["summary"],
                        "notes": record["notes"],
                        "raw_output": record["raw_output"],
                        "collected_at": record["collected_at"],
                        "updated_at": now,
                        "is_missing": False,
                        "missing_since": None,
                    },
                )
            )
            await db.execute(stmt)
            parsed += 1
        except Exception as exc:
            log.error("Error processing %s: %s", path.name, exc)
            errors += 1

    # For each hostname that produced files this run, mark any DB disk not in the
    # current file set as missing. Hostnames with zero files (SCP failure) are
    # intentionally skipped — we can't distinguish "node down" from "disk gone".
    if seen:
        existing = (await db.execute(
            select(DiskHealthRecord).where(DiskHealthRecord.hostname.in_(seen.keys()))
        )).scalars().all()

        for disk in existing:
            device_seen = disk.nvme_device in seen.get(disk.hostname, set())
            if not device_seen and not disk.is_missing:
                disk.is_missing = True
                disk.missing_since = now
                db.add(disk)
            elif device_seen and disk.is_missing:
                # Reappeared — already cleared by upsert above, but guard for safety
                disk.is_missing = False
                disk.missing_since = None
                db.add(disk)

    await db.commit()
    log.info("smartctl parse complete: %d parsed, %d errors", parsed, errors)
    return parsed, errors


async def collect_and_parse(db: AsyncSession) -> CollectResult:
    from .scp_service import collect_all_nodes

    node_results = await collect_all_nodes(db)
    nodes_collected = sum(1 for r in node_results if r.error is None)
    nodes_failed = sum(1 for r in node_results if r.error is not None)

    files_parsed, parse_errors = await parse_and_upsert_all(db)

    return CollectResult(
        nodes_collected=nodes_collected,
        nodes_failed=nodes_failed,
        files_parsed=files_parsed,
        parse_errors=parse_errors,
    )
