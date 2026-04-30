"""Unit tests for nomination business logic (SUBTASK-5, SUBTASK-6)."""

from unittest.mock import MagicMock, patch

import pytest

from app.models.nomination import Nomination, SubmissionType
from app.schemas.nomination import NominationCreate, SupervisorInfo
from app.services.nomination_service import NominationService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_payload(**kwargs) -> NominationCreate:
    defaults = dict(
        nominee_name="Jane Doe",
        nominee_email="jane.doe@example.com",
        submission_type=SubmissionType.SELF_NOMINATION,
    )
    defaults.update(kwargs)
    return NominationCreate(**defaults)


def _mock_db():
    """Return a lightweight mock SQLAlchemy session."""
    db = MagicMock()
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock(side_effect=lambda obj: None)
    return db


# ---------------------------------------------------------------------------
# SUBTASK-5: SubmissionType enum values
# ---------------------------------------------------------------------------

class TestSubmissionTypeEnum:
    def test_all_values_present(self):
        values = {e.value for e in SubmissionType}
        assert "Self-Nomination" in values
        assert "Manager-Nomination" in values
        assert "Nomination Approved by Supervisor" in values

    def test_enum_count(self):
        assert len(SubmissionType) == 3


# ---------------------------------------------------------------------------
# SUBTASK-6: Nomination creation business logic
# ---------------------------------------------------------------------------

class TestNominationServiceCreate:
    def setup_method(self):
        self.service = NominationService()

    def test_self_nomination_does_not_call_workday(self):
        db = _mock_db()
        payload = _make_payload(submission_type=SubmissionType.SELF_NOMINATION)

        with patch(
            "app.services.nomination_service.workday_service"
        ) as mock_workday:
            self.service.create_nomination(db, payload)
            mock_workday.get_supervisor_for_employee.assert_not_called()

    def test_manager_nomination_does_not_call_workday(self):
        db = _mock_db()
        payload = _make_payload(submission_type=SubmissionType.MANAGER_NOMINATION)

        with patch(
            "app.services.nomination_service.workday_service"
        ) as mock_workday:
            self.service.create_nomination(db, payload)
            mock_workday.get_supervisor_for_employee.assert_not_called()

    def test_supervisor_approved_requires_nominee_global_id(self):
        db = _mock_db()
        payload = _make_payload(submission_type=SubmissionType.SUPERVISOR_APPROVED)

        with pytest.raises(ValueError, match="nominee_global_id is required"):
            self.service.create_nomination(db, payload, nominee_global_id=None)

    def test_supervisor_approved_stores_supervisor_info(self):
        db = _mock_db()
        payload = _make_payload(submission_type=SubmissionType.SUPERVISOR_APPROVED)
        supervisor = SupervisorInfo(global_id="SUP-001", name="Alice Manager")

        with patch(
            "app.services.nomination_service.workday_service"
        ) as mock_workday:
            mock_workday.get_supervisor_for_employee.return_value = supervisor
            nomination = self.service.create_nomination(
                db, payload, nominee_global_id="EMP-999"
            )

        mock_workday.get_supervisor_for_employee.assert_called_once_with("EMP-999")
        assert nomination.supervisor_global_id == "SUP-001"
        assert nomination.supervisor_name == "Alice Manager"

    def test_supervisor_approved_raises_when_workday_returns_none(self):
        db = _mock_db()
        payload = _make_payload(submission_type=SubmissionType.SUPERVISOR_APPROVED)

        with patch(
            "app.services.nomination_service.workday_service"
        ) as mock_workday:
            mock_workday.get_supervisor_for_employee.return_value = None
            with pytest.raises(ValueError, match="Could not retrieve supervisor"):
                self.service.create_nomination(
                    db, payload, nominee_global_id="EMP-404"
                )

    def test_nomination_persisted_to_db(self):
        db = _mock_db()
        payload = _make_payload()
        self.service.create_nomination(db, payload)

        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_submission_type_preserved(self):
        db = _mock_db()
        for sub_type in [
            SubmissionType.SELF_NOMINATION,
            SubmissionType.MANAGER_NOMINATION,
        ]:
            payload = _make_payload(submission_type=sub_type)
            nomination = self.service.create_nomination(db, payload)
            assert nomination.submission_type == sub_type
