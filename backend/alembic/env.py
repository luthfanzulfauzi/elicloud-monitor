import asyncio
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# Import all models so autogenerate can detect them
from app.database import Base  # noqa: E402
from app.models import (  # noqa: E402, F401
    Host, PrimaryStorage, Project, VM, Volume, EIP, Tag,
    SnapshotHost, SnapshotStorage, CollectionLog,
)
from app.models.user import AppUser  # noqa: E402, F401
from app.models.disk_health import DiskHealthRecord  # noqa: E402, F401
from app.models.storage_node import StorageNode  # noqa: E402, F401
from app.models.resource_group import ResourceGroup  # noqa: E402, F401
from app.models.host_disk import HostDiskRecord  # noqa: E402, F401
from app.models.osd_mapping import OsdMapping  # noqa: E402, F401
from app.models.ceph_osd import CephOsdRecord  # noqa: E402, F401

target_metadata = Base.metadata


def _get_url() -> str:
    # Prefer DATABASE_URL env var; fall back to alembic.ini
    import os
    url = os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def run_migrations_offline() -> None:
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    url = _get_url()
    connectable = create_async_engine(url, echo=False)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
