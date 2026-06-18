from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy import func
import uuid
from ..database import Base


class UserProjectScope(Base):
    __tablename__ = "user_project_scope"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_user_project_scope"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)


class UserResourceGroupScope(Base):
    __tablename__ = "user_resource_group_scope"
    __table_args__ = (UniqueConstraint("user_id", "resource_group_id", name="uq_user_resource_group_scope"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_group_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("resource_groups.id", ondelete="CASCADE"), nullable=False)
