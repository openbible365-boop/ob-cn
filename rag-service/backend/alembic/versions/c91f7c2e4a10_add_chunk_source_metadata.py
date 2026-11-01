"""add chunk source metadata

Revision ID: c91f7c2e4a10
Revises: 8fbf7f5ddea6
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "c91f7c2e4a10"
down_revision: Union[str, None] = "8fbf7f5ddea6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("document_chunks", sa.Column("page_number", sa.Integer(), nullable=True))
    op.add_column("document_chunks", sa.Column("section_title", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("document_chunks", "section_title")
    op.drop_column("document_chunks", "page_number")
