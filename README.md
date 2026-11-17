# scholarship-portal

Scholarship applications, applicant sign-in, tracking, verification launch and officer review.

## Local foundation probe

Copy .env.example to .env for local settings. From this directory run `docker build -t scholarship-portal-probe .` then `docker run --rm -e PORT=3000 -p 127.0.0.1:3000:3000 scholarship-portal-probe`. GET /health.txt reports the static foundation marker. Business endpoints and pages belong to subsequent phases.

Public hosting is managed by the project owner. Build from this directory only. Configure per-environment HTTPS URLs and credentials on the host. 

## Verification inputs

An application records the applicant's MahaSetu student ID (MHSTU followed by four digits) and a ten-digit mobile number (revision 0003). Both are required on submission. The ID links department records and the mobile number receives one-time codes and result messages from MahaSetu. The mobile number is masked on screen. 

## Verify with MahaSetu

On an application the student chooses **Verify with MahaSetu**. The portal's server asks MahaSetu Core which departments and documents this service may request (`GET /v1/services/{id}/requirements`), creates a verification request with the saved student ID and mobile number, records the attempt in `verification_transactions` (revision 0004) and sends the browser to the MahaSetu website. MahaSetu returns the student to `/verification/return?ref=<transaction>`. That address only names a transaction: the portal reads the outcome from Core with its own credential, and only for a transaction that belongs to the signed-in student, so a forged link cannot mark anything verified. The application then shows **Verified**, **Not verified** (a requirement was not met) or **Incomplete** (anything else, including a department being unavailable) with MahaSetu's plain-language reasons. Starting again cancels an abandoned attempt. Only the reasons and counts are stored, never department records. Officers see the same result read-only; the decision workflow is unchanged.

Settings (server side only): `MAHASETU_CORE_URL`, `MAHASETU_SITE_URL` (where the browser is sent), `MAHASETU_REQUESTER_TOKEN` (the credential Core registered for this service) and `MAHASETU_SERVICE_ID`. See `.env.example`. Browser tests are in `tests/test_mahasetu.py` and need the whole local stack (see its docstring); `tests/test_scholarship.py` needs sign-in and storage, from Supabase or from the laptop-only stand-in in `tools/local-identity` (see its README).

**Demo guide.** `/demo-guide` is a public page for judges and reviewers: the six steps of the journey, what to type, the five synthetic demonstration students (ID, mobile number, expected outcome and reasons, and what each department holds), and how each department exposes its records. Its content is static text in `lib/demo-guide.ts`, mirroring the department fixtures, and it needs no database or sign-in. Optional `DEMO_REVENUE_SITE_URL`, `DEMO_EXAMINATION_SITE_URL` and `DEMO_UNIVERSITY_SITE_URL` add links to the department websites; without them the guide says "Not published". The message inbox link uses `MAHASETU_SITE_URL`.

## Database

Install requirements-db.txt in a local virtual environment. Set MIGRATION_DATABASE_URL to a confirmed PostgreSQL SQLAlchemy URL (postgresql+psycopg://...) supplied through the environment. From this directory run `alembic upgrade head` and `alembic current`. Apply db/seed.sql only to a synthetic environment with psql. Runtime credentials must be scoped to the scholarship schema. The migration identity needs schema creation and role administration privileges.
