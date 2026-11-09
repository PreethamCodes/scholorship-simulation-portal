# scholarship-portal

Scholarship applications, applicant sign-in, tracking, verification launch and officer review.

## Local foundation probe

Copy .env.example to .env for local settings. From this directory run `docker build -t scholarship-portal-probe .` then `docker run --rm -e PORT=3000 -p 127.0.0.1:3000:3000 scholarship-portal-probe`. GET /health.txt reports the static foundation marker. Business endpoints and pages belong to subsequent phases.

Public hosting is managed by the project owner. Build from this directory only. Configure per-environment HTTPS URLs and credentials on the host. 

## Database

Install requirements-db.txt in a local virtual environment. Set MIGRATION_DATABASE_URL to a confirmed PostgreSQL SQLAlchemy URL (postgresql+psycopg://...) supplied through the environment. From this directory run `alembic upgrade head` and `alembic current`. Apply db/seed.sql only to a synthetic environment with psql. Runtime credentials must be scoped to the scholarship schema. The migration identity needs schema creation and role administration privileges.
