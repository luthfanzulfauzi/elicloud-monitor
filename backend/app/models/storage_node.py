from sqlalchemy import String, Text, Integer, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class StorageNode(Base):
    __tablename__ = "storage_nodes"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    hostname: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    ssh_host: Mapped[str] = mapped_column(String, nullable=False)
    ssh_port: Mapped[int] = mapped_column(Integer, nullable=False, default=22)
    ssh_user: Mapped[str] = mapped_column(String, nullable=False)
    ssh_key_path: Mapped[str] = mapped_column(String, nullable=False)
    remote_dir: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_collected_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_collect_status: Mapped[str | None] = mapped_column(String, nullable=True)
    last_collect_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
