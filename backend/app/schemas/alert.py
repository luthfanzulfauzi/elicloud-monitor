import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AlertChannelCreate(BaseModel):
    name: str
    channel_type: str = "google_chat"
    webhook_url: str
    enabled: bool = True


class AlertChannelUpdate(BaseModel):
    name: str | None = None
    webhook_url: str | None = None
    enabled: bool | None = None


class AlertChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    channel_type: str
    webhook_url: str
    enabled: bool
    created_at: datetime


class AlertRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    module: str
    level: str
    interval_hours: float
    enabled: bool


class AlertRuleUpdate(BaseModel):
    interval_hours: float | None = None
    enabled: bool | None = None


class AlertTestResult(BaseModel):
    success: bool
    message: str
