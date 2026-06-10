import logging
import re
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.host import Host
from ..models.host_disk import HostDiskRecord

log = logging.getLogger(__name__)

# Virtual/pseudo filesystem types — no real capacity meaning
_EXCLUDED_FSTYPES = frozenset({
    "devtmpfs", "tmpfs", "proc", "sysfs", "cgroup", "cgroup2", "overlay",
    "squashfs", "devpts", "securityfs", "pstore", "configfs", "debugfs",
    "hugetlbfs", "mqueue", "fusectl", "tracefs", "bpf", "nsfs", "autofs",
    "efivarfs", "rpc_pipefs",
})

_WANTED_METRICS = {
    "node_filesystem_size_bytes",
    "node_filesystem_avail_bytes",
    "node_filesystem_files",
    "node_filesystem_files_free",
}

_METRIC_RE = re.compile(r'^(\w+)\{([^}]*)\}\s+([\d.eE+\-]+)')
_LABEL_RE = re.compile(r'(\w+)="([^"]*)"')


def _parse_labels(label_str: str) -> dict[str, str]:
    return {m.group(1): m.group(2) for m in _LABEL_RE.finditer(label_str)}


def _parse_metrics(text: str) -> dict[tuple[str, str], dict]:
    """Parse Prometheus text format. Returns {(device, mountpoint): {metric: value, fstype: str}}."""
    data: dict[tuple[str, str], dict] = {}
    fstypes: dict[tuple[str, str], str] = {}

    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        m = _METRIC_RE.match(line)
        if not m:
            continue
        metric_name = m.group(1)
        if metric_name not in _WANTED_METRICS:
            continue
        labels = _parse_labels(m.group(2))
        device = labels.get("device", "")
        mountpoint = labels.get("mountpoint", "")
        fstype = labels.get("fstype", "")
        key = (device, mountpoint)
        fstypes[key] = fstype
        try:
            value = float(m.group(3))
        except ValueError:
            continue
        if key not in data:
            data[key] = {}
        data[key][metric_name] = value

    for key in data:
        data[key]["_fstype"] = fstypes.get(key, "")

    return data


async def scrape_host(host_ip: str, port: int = 9100) -> list[dict]:
    """Scrape node_exporter at host_ip:port. Returns per-mountpoint dicts."""
    url = f"http://{host_ip}:{port}/metrics"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    raw = _parse_metrics(resp.text)
    results = []
    now = datetime.now(timezone.utc)

    for (device, mountpoint), metrics in raw.items():
        fstype = metrics.get("_fstype", "")
        if fstype in _EXCLUDED_FSTYPES:
            continue
        size_bytes = metrics.get("node_filesystem_size_bytes", 0)
        if size_bytes <= 0:
            continue

        avail_bytes = metrics.get("node_filesystem_avail_bytes", 0)
        used_bytes = int(size_bytes - avail_bytes)
        use_pct = round((used_bytes / size_bytes) * 100, 2)

        inodes_total_raw = metrics.get("node_filesystem_files")
        inodes_free_raw = metrics.get("node_filesystem_files_free")
        inodes_total: int | None = None
        inodes_used: int | None = None
        inode_use_pct: float | None = None
        if inodes_total_raw is not None and inodes_free_raw is not None and inodes_total_raw > 0:
            inodes_total = int(inodes_total_raw)
            inodes_used = int(inodes_total_raw - inodes_free_raw)
            inode_use_pct = round((inodes_used / inodes_total) * 100, 2)

        results.append({
            "mountpoint": mountpoint,
            "device": device,
            "fstype": fstype,
            "size_bytes": int(size_bytes),
            "used_bytes": used_bytes,
            "avail_bytes": int(avail_bytes),
            "use_pct": use_pct,
            "inodes_total": inodes_total,
            "inodes_used": inodes_used,
            "inode_use_pct": inode_use_pct,
            "collected_at": now,
        })

    return results


async def scrape_and_upsert_all(db: AsyncSession) -> tuple[int, int]:
    """Scrape all hosts and upsert results. Returns (success_count, error_count)."""
    hosts = (await db.execute(select(Host))).scalars().all()
    success = 0
    errors = 0

    for host in hosts:
        if not host.management_ip:
            log.warning("Host %s has no management_ip, skipping disk scrape", host.name)
            errors += 1
            continue
        try:
            records = await scrape_host(host.management_ip, settings.PROMETHEUS_NODE_EXPORTER_PORT)
            for rec in records:
                stmt = (
                    pg_insert(HostDiskRecord)
                    .values(host_id=host.id, **rec)
                    .on_conflict_do_update(
                        constraint="uq_host_disk_host_mountpoint",
                        set_={
                            "device": rec["device"],
                            "fstype": rec["fstype"],
                            "size_bytes": rec["size_bytes"],
                            "used_bytes": rec["used_bytes"],
                            "avail_bytes": rec["avail_bytes"],
                            "use_pct": rec["use_pct"],
                            "inodes_total": rec["inodes_total"],
                            "inodes_used": rec["inodes_used"],
                            "inode_use_pct": rec["inode_use_pct"],
                            "collected_at": rec["collected_at"],
                        },
                    )
                )
                await db.execute(stmt)
            log.info("Scraped host %s (%s): %d mountpoints", host.name, host.management_ip, len(records))
            success += 1
        except Exception as exc:
            log.warning("Failed to scrape host %s (%s): %s", host.name, host.management_ip, exc, exc_info=True)
            errors += 1

    await db.commit()
    log.info("Prometheus disk scrape complete: %d succeeded, %d failed", success, errors)
    return success, errors
