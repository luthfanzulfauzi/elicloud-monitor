from sqlalchemy import Integer, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class SnapshotHost(Base):
    __tablename__ = "snapshot_hosts"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    host_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("hosts.id"), nullable=False, index=True)
    snapshot_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    cpu_total: Mapped[int | None] = mapped_column(Integer)
    cpu_allocated: Mapped[int | None] = mapped_column(Integer)
    memory_total: Mapped[int | None] = mapped_column(BigInteger)
    memory_allocated: Mapped[int | None] = mapped_column(BigInteger)
    vm_count: Mapped[int | None] = mapped_column(Integer)

    host: Mapped["Host"] = relationship("Host", back_populates="snapshots")


class SnapshotStorage(Base):
    __tablename__ = "snapshot_storage"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    primary_storage_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("primary_storage.id"), nullable=False, index=True)
    snapshot_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    capacity_total: Mapped[int | None] = mapped_column(BigInteger)
    capacity_avail: Mapped[int | None] = mapped_column(BigInteger)
    volume_count: Mapped[int | None] = mapped_column(Integer)

    storage: Mapped["PrimaryStorage"] = relationship("PrimaryStorage", back_populates="snapshots")
