"""Add submission_type and supervisor fields to nominations table.

Revision ID: 0001_add_submission_type
Revises:
Create Date: 2024-01-01 00:00:00.000000

SUBTASK-5: Add Submission Type field to Nomination entity.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_add_submission_type"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create SubmissionType enum
    submissiontype = sa.Enum(
        "Self-Nomination",
        "Manager-Nomination",
        "Nomination Approved by Supervisor",
        name="submissiontype",
    )
    submissiontype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "nominations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nominee_name", sa.String(255), nullable=False),
        sa.Column("nominee_email", sa.String(255), nullable=False),
        sa.Column(
            "submission_type",
            sa.Enum(
                "Self-Nomination",
                "Manager-Nomination",
                "Nomination Approved by Supervisor",
                name="submissiontype",
                create_type=False,
            ),
            nullable=False,
            server_default="Self-Nomination",
        ),
        sa.Column("supervisor_global_id", sa.String(255), nullable=True),
        sa.Column("supervisor_name", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("nominations")
    sa.Enum(name="submissiontype").drop(op.get_bind(), checkfirst=True)
