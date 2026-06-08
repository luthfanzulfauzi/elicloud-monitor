from sqlalchemy import String, Text, Integer, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class VM(Base):
    __tablename__ = "vms"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    zstack_uuid: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str | None] = mapped_column(String)
    host_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("hosts.id"), nullable=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    private_ip: Mapped[str | None] = mapped_column(String)
    eip: Mapped[str | None] = mapped_column(String)
    vcpu_num: Mapped[int | None] = mapped_column(Integer)
    memory_size: Mapped[int | None] = mapped_column(BigInteger)
    platform: Mapped[str | None] = mapped_column(String)
    image_name: Mapped[str | None] = mapped_column(String)
    hypervisor_type: Mapped[str | None] = mapped_column(String)
    owner: Mapped[str | None] = mapped_column(String)
    vm_type: Mapped[str | None] = mapped_column(String)        # UserVm | ApplianceVm
    appliance_type: Mapped[str | None] = mapped_column(String) # VirtualRouter | LoadBalancer | …
    # Original creation timestamp from ZStack — never overwrite
    zstack_created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    host: Mapped["Host | None"] = relationship("Host", back_populates="vms")
    project: Mapped["Project | None"] = relationship("Project", back_populates="vms")
    volumes: Mapped[list["Volume"]] = relationship("Volume", back_populates="vm")
    tags: Mapped[list["Tag"]] = relationship("Tag", back_populates="vm", cascade="all, delete-orphan")
    eips: Mapped[list["EIP"]] = relationship("EIP", back_populates="vm")
