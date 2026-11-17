"""Student applications and officer review."""
from pathlib import Path
from alembic import op

revision = "scholarship_0002"
down_revision = "scholarship_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().exec_driver_sql(Path(__file__).with_suffix(".sql").read_text(encoding="utf-8"))


def downgrade():
    raise RuntimeError("Restoring this revision requires a reviewed data backup.")
