from sqlalchemy import String, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    vm_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("vms.id"), nullable=False, index=True)
    tag_key: Mapped[str] = mapped_column(String, nullable=False)
    tag_value: Mapped[str | None] = mapped_column(String)
    zstack_uuid: Mapped[str | None] = mapped_column(String, index=True)

    vm: Mapped["VM"] = relationship("VM", back_populates="tags")
