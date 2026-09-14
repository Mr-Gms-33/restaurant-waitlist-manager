"""Staff-facing party/queue management endpoints - require a bearer token.

Mirrors the `Staff - Parties` tag in `openapi.yaml`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..dependencies import get_current_staff, get_store
from ..models import (
    AssignTableInput,
    AssignTableResponse,
    Party,
    ReorderPartiesInput,
    UpdatePartyStatusInput,
    UpdateWaitTimeInput,
)
from ..store import WaitlistStore

router = APIRouter(tags=["Staff - Parties"], dependencies=[Depends(get_current_staff)])


@router.get("/parties", response_model=list[Party], summary="List every party")
def list_parties(store: WaitlistStore = Depends(get_store)) -> list[Party]:
    return store.list_parties()


@router.put("/parties/order", response_model=list[Party], summary="Reorder the waitlist queue")
def reorder_parties(body: ReorderPartiesInput, store: WaitlistStore = Depends(get_store)) -> list[Party]:
    return store.reorder_parties(body.ordered_ids)


@router.patch(
    "/parties/{party_id}/wait-time",
    response_model=Party,
    summary="Set/update the estimated wait time",
)
def update_wait_time(
    party_id: str, body: UpdateWaitTimeInput, store: WaitlistStore = Depends(get_store)
) -> Party:
    return store.update_wait_time(party_id, body.minutes)


@router.patch("/parties/{party_id}/status", response_model=Party, summary="Change a party's status")
def update_party_status(
    party_id: str, body: UpdatePartyStatusInput, store: WaitlistStore = Depends(get_store)
) -> Party:
    return store.update_party_status(party_id, body.status)


@router.post(
    "/parties/{party_id}/assign-table",
    response_model=AssignTableResponse,
    summary="Assign an available table to a party",
)
def assign_table(
    party_id: str, body: AssignTableInput, store: WaitlistStore = Depends(get_store)
) -> AssignTableResponse:
    party, table = store.assign_table(party_id, body.table_id)
    return AssignTableResponse(party=party, table=table)
