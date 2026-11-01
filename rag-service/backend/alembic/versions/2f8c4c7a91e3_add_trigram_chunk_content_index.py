"""add trigram index for commentary keyword recall

Revision ID: 2f8c4c7a91e3
Revises: c91f7c2e4a10
"""

from typing import Sequence, Union

from alembic import op


revision: str = "2f8c4c7a91e3"
down_revision: Union[str, None] = "c91f7c2e4a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_chunks_content_trgm "
        "ON document_chunks USING gin (content gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_content_trgm")
