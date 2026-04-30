"""Pydantic schemas for Nomination."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.nomination import SubmissionType


class NominationBase(BaseModel):
    nominee_name: str
    nominee_email: EmailStr
    submission_type: SubmissionType = SubmissionType.SELF_NOMINATION
    notes: Optional[str] = None


class NominationCreate(NominationBase):
    """Schema used when creating a new nomination."""
    pass


class NominationRead(NominationBase):
    """Schema returned when reading a nomination."""

    id: uuid.UUID
    supervisor_global_id: Optional[str] = None
    supervisor_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupervisorInfo(BaseModel):
    """Supervisor information returned from Workday lookup."""

    global_id: str
    name: str
    email: Optional[str] = None
