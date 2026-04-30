"""Nomination ORM models."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SubmissionType(str, enum.Enum):
    """Allowed submission types for a nomination."""

    SELF_NOMINATION = "Self-Nomination"
    MANAGER_NOMINATION = "Manager-Nomination"
    SUPERVISOR_APPROVED = "Nomination Approved by Supervisor"


class Nomination(Base):
    """Nomination entity."""

    __tablename__ = "nominations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nominee_name = Column(String(255), nullable=False)
    nominee_email = Column(String(255), nullable=False)
    submission_type = Column(
        Enum(SubmissionType, name="submissiontype"),
        nullable=False,
        default=SubmissionType.SELF_NOMINATION,
    )
    # Supervisor fields (populated when submission_type == SUPERVISOR_APPROVED)
    supervisor_global_id = Column(String(255), nullable=True)
    supervisor_name = Column(String(255), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
