from sqlalchemy import String, BigInteger, Float, DateTime, Text, Boolean, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class DiskHealthRecord(Base):
    __tablename__ = "disk_health_records"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    hostname: Mapped[str] = mapped_column(String, nullable=False)
    nvme_device: Mapped[str] = mapped_column(String, nullable=False)
    model_number: Mapped[str | None] = mapped_column(String)
    capacity_bytes: Mapped[int | None] = mapped_column(BigInteger)
    tbw: Mapped[float | None] = mapped_column(Float)
    endurance_used_pct: Mapped[float | None] = mapped_column(Float)
    life_remaining_pct: Mapped[float | None] = mapped_column(Float)
    available_spare_pct: Mapped[float | None] = mapped_column(Float)
    disk_health: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)
    raw_output: Mapped[str | None] = mapped_column(Text)
    collected_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    is_missing: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    missing_since: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("hostname", "nvme_device", name="uq_disk_health_hostname_device"),
    )
