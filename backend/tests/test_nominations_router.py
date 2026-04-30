"""Unit tests for the nominations API router (SUBTASK-6, SUBTASK-7)."""

from unittest.mock import MagicMock, patch
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.nomination import SubmissionType
from app.database import get_db

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _mock_nomination(
    submission_type: SubmissionType = SubmissionType.SELF_NOMINATION,
    supervisor_global_id: str | None = None,
    supervisor_name: str | None = None,
):
    now = datetime.utcnow()
    nomination = MagicMock()
    nomination.id = uuid.uuid4()
    nomination.nominee_name = "Jane Doe"
    nomination.nominee_email = "jane@example.com"
    nomination.submission_type = submission_type
    nomination.supervisor_global_id = supervisor_global_id
    nomination.supervisor_name = supervisor_name
    nomination.notes = None
    nomination.created_at = now
    nomination.updated_at = now
    return nomination


@pytest.fixture()
def client():
    """TestClient with a mocked DB session."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    yield TestClient(app), mock_db
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# POST /nominations
# ---------------------------------------------------------------------------

class TestCreateNomination:
    def test_self_nomination_created(self, client):
        test_client, mock_db = client
        nomination = _mock_nomination(SubmissionType.SELF_NOMINATION)

        with patch(
            "app.routers.nominations.nomination_service.create_nomination",
            return_value=nomination,
        ):
            resp = test_client.post(
                "/nominations/",
                json={
                    "nominee_name": "Jane Doe",
                    "nominee_email": "jane@example.com",
                    "submission_type": "Self-Nomination",
                },
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["submission_type"] == "Self-Nomination"

    def test_supervisor_approved_nomination_created(self, client):
        test_client, mock_db = client
        nomination = _mock_nomination(
            SubmissionType.SUPERVISOR_APPROVED,
            supervisor_global_id="SUP-001",
            supervisor_name="Alice Manager",
        )

        with patch(
            "app.routers.nominations.nomination_service.create_nomination",
            return_value=nomination,
        ):
            resp = test_client.post(
                "/nominations/?nominee_global_id=EMP-999",
                json={
                    "nominee_name": "Jane Doe",
                    "nominee_email": "jane@example.com",
                    "submission_type": "Nomination Approved by Supervisor",
                },
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["supervisor_name"] == "Alice Manager"

    def test_invalid_submission_type_rejected(self, client):
        test_client, _ = client
        resp = test_client.post(
            "/nominations/",
            json={
                "nominee_name": "Jane Doe",
                "nominee_email": "jane@example.com",
                "submission_type": "InvalidType",
            },
        )
        assert resp.status_code == 422

    def test_missing_nominee_global_id_raises_422(self, client):
        test_client, _ = client

        with patch(
            "app.routers.nominations.nomination_service.create_nomination",
            side_effect=ValueError("nominee_global_id is required"),
        ):
            resp = test_client.post(
                "/nominations/",
                json={
                    "nominee_name": "Jane Doe",
                    "nominee_email": "jane@example.com",
                    "submission_type": "Nomination Approved by Supervisor",
                },
            )

        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /nominations/supervisor/lookup
# ---------------------------------------------------------------------------

class TestSupervisorLookup:
    def test_returns_supervisor(self, client):
        test_client, _ = client
        from app.schemas.nomination import SupervisorInfo

        supervisor = SupervisorInfo(global_id="SUP-001", name="Alice Manager")
        with patch(
            "app.routers.nominations.workday_service.get_supervisor_for_employee",
            return_value=supervisor,
        ):
            resp = test_client.get(
                "/nominations/supervisor/lookup?employee_global_id=EMP-999"
            )

        assert resp.status_code == 200
        assert resp.json()["name"] == "Alice Manager"

    def test_returns_404_when_not_found(self, client):
        test_client, _ = client
        with patch(
            "app.routers.nominations.workday_service.get_supervisor_for_employee",
            return_value=None,
        ):
            resp = test_client.get(
                "/nominations/supervisor/lookup?employee_global_id=UNKNOWN"
            )

        assert resp.status_code == 404
