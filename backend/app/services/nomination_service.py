"""Business logic for Nomination operations."""

import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.nomination import Nomination, SubmissionType
from app.schemas.nomination import NominationCreate, SupervisorInfo
from app.services.workday_service import workday_service

logger = logging.getLogger(__name__)


class NominationService:
    """Handles creation and retrieval of Nomination records."""

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def create_nomination(
        self,
        db: Session,
        payload: NominationCreate,
        nominee_global_id: Optional[str] = None,
    ) -> Nomination:
        """Validate and persist a new nomination.

        When *submission_type* is ``SUPERVISOR_APPROVED``, the supervisor's
        information is fetched from Workday and stored alongside the record.

        Args:
            db: Active SQLAlchemy session.
            payload: Validated nomination data from the request.
            nominee_global_id: The Workday Global ID of the nominee, used to
                look up their supervisor when the submission type requires it.

        Returns:
            The persisted :class:`Nomination` ORM instance.

        Raises:
            ValueError: If the submission type requires a supervisor but no
                ``nominee_global_id`` was provided, or if supervisor information
                could not be retrieved from Workday.
        """
        supervisor_info: Optional[SupervisorInfo] = None

        if payload.submission_type == SubmissionType.SUPERVISOR_APPROVED:
            supervisor_info = self._resolve_supervisor(nominee_global_id)

        nomination = Nomination(
            nominee_name=payload.nominee_name,
            nominee_email=payload.nominee_email,
            submission_type=payload.submission_type,
            notes=payload.notes,
            supervisor_global_id=supervisor_info.global_id if supervisor_info else None,
            supervisor_name=supervisor_info.name if supervisor_info else None,
        )

        db.add(nomination)
        db.commit()
        db.refresh(nomination)

        logger.info(
            "Nomination %s created with submission_type=%s",
            nomination.id,
            nomination.submission_type,
        )
        return nomination

    def list_nominations(self, db: Session) -> List[Nomination]:
        """Return all nominations ordered by creation date descending."""
        return (
            db.query(Nomination).order_by(Nomination.created_at.desc()).all()
        )

    def get_nomination(self, db: Session, nomination_id: str) -> Optional[Nomination]:
        """Return a single nomination by primary key or ``None``."""
        return db.query(Nomination).filter(Nomination.id == nomination_id).first()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _resolve_supervisor(
        self, nominee_global_id: Optional[str]
    ) -> SupervisorInfo:
        """Fetch and return supervisor info; raise ``ValueError`` on failure."""
        if not nominee_global_id:
            raise ValueError(
                "nominee_global_id is required for Supervisor-Approved nominations."
            )

        supervisor = workday_service.get_supervisor_for_employee(nominee_global_id)
        if supervisor is None:
            raise ValueError(
                f"Could not retrieve supervisor information from Workday for "
                f"employee '{nominee_global_id}'. Please contact HR support."
            )

        return supervisor


nomination_service = NominationService()
