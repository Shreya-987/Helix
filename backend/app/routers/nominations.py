"""FastAPI router for nominations."""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.nomination import NominationCreate, NominationRead, SupervisorInfo
from app.services.nomination_service import nomination_service
from app.services.workday_service import workday_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nominations", tags=["nominations"])


@router.post("/", response_model=NominationRead, status_code=status.HTTP_201_CREATED)
def create_nomination(
    payload: NominationCreate,
    nominee_global_id: Optional[str] = Query(
        default=None,
        description=(
            "Workday Global ID of the nominee. Required when submission_type is "
            "'Nomination Approved by Supervisor'."
        ),
    ),
    db: Session = Depends(get_db),
):
    """Create a new nomination.

    When *submission_type* is ``'Nomination Approved by Supervisor'``, the
    ``nominee_global_id`` query parameter **must** be supplied so that
    supervisor information can be retrieved from Workday.
    """
    try:
        return nomination_service.create_nomination(db, payload, nominee_global_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.get("/", response_model=List[NominationRead])
def list_nominations(db: Session = Depends(get_db)):
    """List all nominations."""
    return nomination_service.list_nominations(db)


@router.get("/{nomination_id}", response_model=NominationRead)
def get_nomination(nomination_id: str, db: Session = Depends(get_db)):
    """Retrieve a single nomination by ID."""
    nomination = nomination_service.get_nomination(db, nomination_id)
    if nomination is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Nomination not found"
        )
    return nomination


@router.get("/supervisor/lookup", response_model=Optional[SupervisorInfo])
def lookup_supervisor(
    employee_global_id: str = Query(..., description="Workday Global ID of the employee"),
):
    """Return supervisor information for the given employee from Workday.

    This endpoint is called by the UI to auto-populate the supervisor name
    before the form is submitted.
    """
    supervisor = workday_service.get_supervisor_for_employee(employee_global_id)
    if supervisor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supervisor not found for employee '{employee_global_id}'",
        )
    return supervisor
