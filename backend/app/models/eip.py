from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class EIP(Base):
    __tablename__ = "eips"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    zstack_uuid: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(String, nullable=False)
    guest_ip: Mapped[str | None] = mapped_column(String)
    vm_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("vms.id"), nullable=True)
    state: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    vm: Mapped["VM | None"] = relationship("VM", back_populates="eips")
