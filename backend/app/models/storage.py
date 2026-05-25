from sqlalchemy import String, BigInteger, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
import uuid
from ..database import Base


class PrimaryStorage(Base):
    __tablename__ = "primary_storage"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    zstack_uuid: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    storage_type: Mapped[str | None] = mapped_column(String)
    url: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)
    status: Mapped[str | None] = mapped_column(String)
    capacity_total: Mapped[int | None] = mapped_column(BigInteger)
    capacity_avail: Mapped[int | None] = mapped_column(BigInteger)
    capacity_total_physical: Mapped[int | None] = mapped_column(BigInteger)
    capacity_avail_physical: Mapped[int | None] = mapped_column(BigInteger)
    ceph_pools: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    volumes: Mapped[list["Volume"]] = relationship("Volume", back_populates="primary_storage")
    snapshots: Mapped[list["SnapshotStorage"]] = relationship("SnapshotStorage", back_populates="storage")
