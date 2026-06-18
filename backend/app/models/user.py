from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
import uuid
from ..database import Base


class AppUser(Base):
    __tablename__ = "app_users"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String, nullable=False)       # Admin | Operator | Viewer
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="Active")
    password_hash: Mapped[str | None] = mapped_column(String)
    permissions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Data scope: "global" (see all) | "project" | "resource_group"
    scope_type: Mapped[str] = mapped_column(String, nullable=False, server_default="global", default="global")
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    last_active_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
