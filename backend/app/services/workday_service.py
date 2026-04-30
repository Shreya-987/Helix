"""Workday integration service – retrieves and caches supervisor information."""

import logging
from functools import lru_cache
from typing import Optional

import httpx

from app.schemas.nomination import SupervisorInfo

logger = logging.getLogger(__name__)

_WORKDAY_BASE_URL = "https://workday.example.com/api/v1"  # Replace with real URL


class WorkdayService:
    """Thin wrapper around the Workday REST API.

    Results are cached in memory using ``lru_cache`` so that repeated calls for
    the same employee ID within a process lifetime avoid redundant network
    round-trips.
    """

    def __init__(self, base_url: str = _WORKDAY_BASE_URL):
        self._base_url = base_url

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def get_supervisor_for_employee(
        self, employee_global_id: str
    ) -> Optional[SupervisorInfo]:
        """Return the supervisor for *employee_global_id* or ``None``.

        Results are cached by employee global ID.
        """
        return self._cached_supervisor(employee_global_id)

    # ------------------------------------------------------------------
    # Internal / cached
    # ------------------------------------------------------------------

    @lru_cache(maxsize=256)
    def _cached_supervisor(self, employee_global_id: str) -> Optional[SupervisorInfo]:
        try:
            with httpx.Client(timeout=10) as client:
                response = client.get(
                    f"{self._base_url}/workers/{employee_global_id}/manager",
                )
                response.raise_for_status()
                data = response.json()
                return SupervisorInfo(
                    global_id=data["globalId"],
                    name=data["name"],
                    email=data.get("email"),
                )
        except httpx.HTTPStatusError as exc:
            # Log status code without echoing the employee ID (may be PII)
            logger.warning(
                "Workday returned HTTP %s when looking up manager: %s",
                exc.response.status_code,
                exc,
            )
            return None
        except Exception as exc:  # noqa: BLE001
            logger.error("Workday manager lookup failed: %s", exc)
            return None


# Module-level singleton
workday_service = WorkdayService()
