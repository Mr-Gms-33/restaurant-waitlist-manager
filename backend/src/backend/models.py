"""Pydantic schemas mirroring the shapes defined in `openapi.yaml`.

Field names are declared in snake_case (idiomatic Python) but each model is
configured to accept and emit camelCase JSON keys (matching the frontend's
`src/types/domain.ts`), via `alias_generator=to_camel`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CamelModel(BaseModel):
    """Base model that (de)serializes camelCase JSON while using snake_case in Python."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class PartyStatus(str, Enum):
    WAITING = "waiting"
    ARRIVAL_CONFIRMED = "arrival_confirmed"
    TABLE_READY = "table_ready"
    SEATED = "seated"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class TableStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    UNAVAILABLE = "unavailable"


# --- Core resources ---------------------------------------------------------------


class Party(CamelModel):
    id: str
    name: str
    party_size: int = Field(ge=1)
    contact: str
    status: PartyStatus
    estimated_wait_minutes: Optional[int] = None
    table_id: Optional[str] = None
    arrival_deadline: Optional[datetime] = None
    arrival_confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class RestaurantTable(CamelModel):
    id: str
    name: str
    capacity: int = Field(ge=1)
    status: TableStatus
    party_id: Optional[str] = None


# --- Request bodies ----------------------------------------------------------------


class JoinWaitlistInput(CamelModel):
    """Field-level validation is intentionally loose (just types): business rules
    like "name can't be blank" are enforced by `WaitlistStore` and surfaced as a
    400 `ErrorResponse`, matching openapi.yaml. Missing/mistyped fields still
    produce FastAPI's standard 422 response.
    """

    name: str
    party_size: int
    contact: str


class AddTableInput(CamelModel):
    name: str
    capacity: int


class UpdateWaitTimeInput(CamelModel):
    minutes: float


class UpdatePartyStatusInput(CamelModel):
    status: PartyStatus


class UpdateTableStatusInput(CamelModel):
    status: TableStatus


class ReorderPartiesInput(CamelModel):
    ordered_ids: list[str]


class AssignTableInput(CamelModel):
    table_id: str


# --- Response bodies ---------------------------------------------------------------


class AssignTableResponse(CamelModel):
    party: Party
    table: RestaurantTable


class QueuePositionResponse(CamelModel):
    position: Optional[int] = None


class ErrorResponse(CamelModel):
    error: str


# --- Auth ----------------------------------------------------------------------------


class LoginRequest(CamelModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class TokenResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    staff_name: str
