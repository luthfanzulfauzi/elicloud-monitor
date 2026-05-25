from sqlalchemy import String, Integer, BigInteger, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class Host(Base):
    __tablename__ = "hosts"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    zstack_uuid: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    management_ip: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)
    status: Mapped[str | None] = mapped_column(String)
    hypervisor_type: Mapped[str | None] = mapped_column(String)
    cpu_total: Mapped[int | None] = mapped_column(Integer)
    cpu_allocated: Mapped[int | None] = mapped_column(Integer)
    memory_total: Mapped[int | None] = mapped_column(BigInteger)
    memory_allocated: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    vms: Mapped[list["VM"]] = relationship("VM", back_populates="host")
    snapshots: Mapped[list["SnapshotHost"]] = relationship("SnapshotHost", back_populates="host")
