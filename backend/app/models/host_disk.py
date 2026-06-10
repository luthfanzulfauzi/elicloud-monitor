from sqlalchemy import String, BigInteger, Float, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class HostDiskRecord(Base):
    __tablename__ = "host_disk_records"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    host_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    mountpoint: Mapped[str] = mapped_column(String, nullable=False)
    device: Mapped[str] = mapped_column(String, nullable=False)
    fstype: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    used_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    avail_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    use_pct: Mapped[float] = mapped_column(Float, nullable=False)
    inodes_total: Mapped[int | None] = mapped_column(BigInteger)
    inodes_used: Mapped[int | None] = mapped_column(BigInteger)
    inode_use_pct: Mapped[float | None] = mapped_column(Float)
    collected_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (
        UniqueConstraint("host_id", "mountpoint", name="uq_host_disk_host_mountpoint"),
    )
