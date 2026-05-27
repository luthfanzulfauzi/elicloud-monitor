import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import asyncssh
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.storage_node import StorageNode

log = logging.getLogger(__name__)


@dataclass
class NodeCollectResult:
    hostname: str
    files_downloaded: int
    error: str | None


async def collect_node(node: StorageNode) -> NodeCollectResult:
    known_hosts = None if not settings.SMARTCTL_KNOWN_HOSTS else settings.SMARTCTL_KNOWN_HOSTS
    try:
        async with asyncssh.connect(
            host=node.ssh_host,
            port=node.ssh_port,
            username=node.ssh_user,
            client_keys=[node.ssh_key_path],
            known_hosts=known_hosts,
        ) as conn:
            async with conn.start_sftp_client() as sftp:
                pattern = f"{node.remote_dir}/*_smart.txt"
                try:
                    matches = await sftp.glob(pattern)
                except asyncssh.SFTPError:
                    matches = []

                dest_dir = Path(settings.SMARTCTL_DIR)
                dest_dir.mkdir(parents=True, exist_ok=True)

                count = 0
                for remote_path in matches:
                    try:
                        async with await sftp.open(remote_path, "r") as f:
                            content = await f.read()
                        dest = dest_dir / Path(remote_path).name
                        dest.write_bytes(content if isinstance(content, bytes) else content.encode())
                        count += 1
                    except Exception as exc:
                        log.warning("Failed to download %s from %s: %s", remote_path, node.hostname, exc)

        return NodeCollectResult(hostname=node.hostname, files_downloaded=count, error=None)
    except Exception as exc:
        log.error("collect_node failed for %s: %s", node.hostname, exc)
        return NodeCollectResult(hostname=node.hostname, files_downloaded=0, error=str(exc))


async def collect_all_nodes(db: AsyncSession) -> list[NodeCollectResult]:
    nodes = (await db.execute(
        select(StorageNode).where(StorageNode.enabled.is_(True))
    )).scalars().all()

    if not nodes:
        return []

    results: list[NodeCollectResult] = await asyncio.gather(
        *(collect_node(n) for n in nodes)
    )

    now = datetime.now(timezone.utc)
    for node, result in zip(nodes, results):
        node.last_collected_at = now
        node.last_collect_status = "success" if result.error is None else "failed"
        node.last_collect_error = result.error
        db.add(node)

    await db.commit()
    return list(results)
