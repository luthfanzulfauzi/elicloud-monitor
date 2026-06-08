import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import settings
from .database import engine, get_db
from .scheduler import scheduler, setup_scheduler
from .security import get_current_user, hash_password
from .routers import auth, dashboard, hosts, storage, vms, projects, resource_groups, users, status, compute, disk_health as disk_health_router, storage_nodes as storage_nodes_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)


async def _seed_admin():
    from .models.user import AppUser
    from .schemas.user import default_permissions

    async for db in get_db():
        existing = (await db.execute(select(AppUser).limit(1))).scalar_one_or_none()
        if existing:
            return
        admin = AppUser(
            name="Administrator",
            email=settings.ADMIN_DEFAULT_EMAIL,
            role="Admin",
            status="Active",
            password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
            permissions=default_permissions("Admin"),
        )
        db.add(admin)
        await db.commit()
        log.info(
            "Default admin created — email: %s  password: %s  (change after first login)",
            settings.ADMIN_DEFAULT_EMAIL,
            settings.ADMIN_DEFAULT_PASSWORD,
        )


def _alembic_upgrade() -> None:
    """Run alembic upgrade head in a thread (env.py uses asyncio.run, can't run in async context)."""
    import os
    from alembic.config import Config
    from alembic import command

    ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    cfg = Config(os.path.abspath(ini_path))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(_alembic_upgrade)
    log.info("Database migrations applied")

    await _seed_admin()

    from .services.smartctl_service import parse_and_upsert_all
    async for db in get_db():
        parsed, errors = await parse_and_upsert_all(db)
        log.info("Initial smartctl parse: %d parsed, %d errors", parsed, errors)
        break

    setup_scheduler()
    scheduler.start()
    log.info("Scheduler started (interval=%ds)", settings.ZSTACK_POLL_INTERVAL_SECONDS)

    yield

    scheduler.shutdown(wait=False)
    log.info("Scheduler stopped")
    await engine.dispose()


app = FastAPI(
    title="EliCloud Monitor API",
    version="1.0.0",
    description="Read-only monitoring and reporting for ZStack private cloud",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"

# Public — no auth required
app.include_router(auth.router, prefix=PREFIX)

# Protected — all routes require a valid JWT
_protected = {"dependencies": [Depends(get_current_user)]}
app.include_router(dashboard.router, prefix=PREFIX, **_protected)
app.include_router(hosts.router, prefix=PREFIX, **_protected)
app.include_router(storage.router, prefix=PREFIX, **_protected)
app.include_router(vms.router, prefix=PREFIX, **_protected)
app.include_router(projects.router, prefix=PREFIX, **_protected)
app.include_router(resource_groups.router, prefix=PREFIX, **_protected)
app.include_router(users.router, prefix=PREFIX, **_protected)
app.include_router(compute.router, prefix=PREFIX, **_protected)
app.include_router(status.router, prefix=PREFIX, **_protected)
app.include_router(disk_health_router.router, prefix=PREFIX, **_protected)
app.include_router(storage_nodes_router.router, prefix=PREFIX, **_protected)


@app.get("/")
async def root():
    return {"name": "EliCloud Monitor API", "version": "1.0.0", "docs": "/docs"}
