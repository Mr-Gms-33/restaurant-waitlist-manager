"""Guest-facing endpoints - no authentication.

Covers joining the waitlist, checking status, confirming arrival, and
leaving. Mirrors the `Guest` tag in `openapi.yaml`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_store
from ..models import JoinWaitlistInput, Party, QueuePositionResponse
from ..store import WaitlistStore

router = APIRouter(tags=["Guest"])


@router.post(
    "/parties",
    response_model=Party,
    status_code=status.HTTP_201_CREATED,
    summary="Join the waitlist",
)
def join_waitlist(body: JoinWaitlistInput, store: WaitlistStore = Depends(get_store)) -> Party:
    return store.join_waitlist(name=body.name, party_size=body.party_size, contact=body.contact)


@router.get("/parties/{party_id}", response_model=Party, summary="Get a party's current status")
def get_party(party_id: str, store: WaitlistStore = Depends(get_store)) -> Party:
    party = store.get_party(party_id)
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Party {party_id} not found")
    return party


@router.delete("/parties/{party_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Leave the waitlist")
def leave_waitlist(party_id: str, store: WaitlistStore = Depends(get_store)) -> None:
    store.leave_waitlist(party_id)


@router.get(
    "/parties/{party_id}/queue-position",
    response_model=QueuePositionResponse,
    summary="Get a party's position in the queue",
)
def get_queue_position(party_id: str, store: WaitlistStore = Depends(get_store)) -> QueuePositionResponse:
    if store.get_party(party_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Party {party_id} not found")
    return QueuePositionResponse(position=store.get_queue_position(party_id))


@router.post(
    "/parties/{party_id}/confirm-arrival",
    response_model=Party,
    summary="Guest confirms arrival (\"I'm here\")",
)
def confirm_arrival(party_id: str, store: WaitlistStore = Depends(get_store)) -> Party:
    return store.confirm_arrival(party_id)
