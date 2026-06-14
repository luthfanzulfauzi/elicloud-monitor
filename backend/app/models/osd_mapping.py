from sqlalchemy import String, Integer, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class OsdMapping(Base):
    __tablename__ = "osd_mappings"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    hostname: Mapped[str] = mapped_column(String, nullable=False)
    nvme_device: Mapped[str] = mapped_column(String, nullable=False)
    osd_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    size: Mapped[str | None] = mapped_column(String, nullable=True)
    mount_path: Mapped[str | None] = mapped_column(String, nullable=True)
    collected_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("hostname", "nvme_device", name="uq_osd_mapping_hostname_nvme"),
    )
