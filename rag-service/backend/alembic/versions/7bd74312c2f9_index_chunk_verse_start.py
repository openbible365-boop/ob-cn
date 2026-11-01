"""index document chunk verse starts

Revision ID: 7bd74312c2f9
Revises: 2f8c4c7a91e3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7bd74312c2f9"
down_revision: Union[str, None] = "2f8c4c7a91e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_document_chunks_verse_start",
        "document_chunks",
        ["verse_start"],
        unique=False,
        postgresql_where=sa.text("verse_start IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_document_chunks_verse_start",
        table_name="document_chunks",
    )
