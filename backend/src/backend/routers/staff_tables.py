"""Staff-facing table management endpoints - require a bearer token.

Mirrors the `Staff - Tables` tag in `openapi.yaml`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ..dependencies import get_current_staff, get_store
from ..models import AddTableInput, RestaurantTable, UpdateTableStatusInput
from ..store import WaitlistStore

router = APIRouter(tags=["Staff - Tables"], dependencies=[Depends(get_current_staff)])


@router.get("/tables", response_model=list[RestaurantTable], summary="List every table")
def list_tables(store: WaitlistStore = Depends(get_store)) -> list[RestaurantTable]:
    return store.list_tables()


@router.post(
    "/tables",
    response_model=RestaurantTable,
    status_code=status.HTTP_201_CREATED,
    summary="Add a table",
)
def add_table(body: AddTableInput, store: WaitlistStore = Depends(get_store)) -> RestaurantTable:
    return store.add_table(name=body.name, capacity=body.capacity)


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a table")
def remove_table(table_id: str, store: WaitlistStore = Depends(get_store)) -> None:
    store.remove_table(table_id)


@router.patch(
    "/tables/{table_id}/status",
    response_model=RestaurantTable,
    summary="Change a table's status",
)
def update_table_status(
    table_id: str, body: UpdateTableStatusInput, store: WaitlistStore = Depends(get_store)
) -> RestaurantTable:
    return store.update_table_status(table_id, body.status)


@router.post("/tables/{table_id}/release", response_model=RestaurantTable, summary="Release a table")
def release_table(table_id: str, store: WaitlistStore = Depends(get_store)) -> RestaurantTable:
    return store.release_table(table_id)
