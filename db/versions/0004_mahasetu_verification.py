"""Record MahaSetu verification attempts and outcomes."""
from pathlib import Path

from alembic import op

revision = "scholarship_0004"
down_revision = "scholarship_0003"
branch_labels = None
depends_on = None


def upgrade():
    sql = Path(__file__).with_suffix(".sql").read_text(encoding="utf-8")
    op.get_bind().exec_driver_sql(sql)


def downgrade():
    raise RuntimeError("Restore from a reviewed backup; this revision records verification outcomes.")
