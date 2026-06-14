from sqlalchemy import String, Integer, BigInteger, Float, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class CephOsdRecord(Base):
    __tablename__ = "ceph_osd_records"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    osd_id: Mapped[int] = mapped_column(Integer, nullable=False)
    osd_name: Mapped[str | None] = mapped_column(String, nullable=True)
    kb_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    kb_used: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    kb_avail: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    utilization: Mapped[float | None] = mapped_column(Float, nullable=True)
    var: Mapped[float | None] = mapped_column(Float, nullable=True)
    crush_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    reweight: Mapped[float | None] = mapped_column(Float, nullable=True)
    pgs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    source_hostname: Mapped[str | None] = mapped_column(String, nullable=True)
    collected_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("osd_id", name="uq_ceph_osd_id"),
    )
