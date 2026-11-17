SET LOCAL search_path TO scholarship, pg_catalog;

-- The portal asks MahaSetu to verify an application and later records the outcome it reads back from MahaSetu.
-- verification_status on the application is what the portal shows. It keeps the earlier two values and adds the
-- outcome of the latest MahaSetu verification:
--   VERIFIED     every requirement was met
--   NOT_VERIFIED a requirement was definitively not met
--   INCOMPLETE   anything else (partial, missing records, a department unavailable, no permission, ...)
ALTER TABLE scholarship_applications DROP CONSTRAINT scholarship_applications_verification_status_check;
ALTER TABLE scholarship_applications ADD CONSTRAINT verification_status_values
  CHECK (verification_status IN ('NOT_REQUESTED','AWAITING_EXTERNAL_VERIFICATION','VERIFIED','NOT_VERIFIED','INCOMPLETE'));

-- One row per verification attempt (a MahaSetu transaction). Reasons are MahaSetu's plain-language messages only;
-- no department records are stored here.
ALTER TABLE verification_transactions
  ADD COLUMN mahasetu_student_id text NOT NULL DEFAULT '',
  ADD COLUMN status text NOT NULL DEFAULT 'AWAITING' CHECK (status IN ('AWAITING','COMPLETED','CANCELLED')),
  ADD COLUMN core_state text CHECK (core_state IN ('VERIFIED','FAILED_CHECK','PARTIAL','MANUAL_REVIEW','INSUFFICIENT_DATA',
    'RULES_NOT_CONFIGURED','ACCESS_DENIED','PROVIDER_ERROR','CANCELLED')),
  ADD COLUMN passed integer CHECK (passed >= 0),
  ADD COLUMN failed integer CHECK (failed >= 0),
  ADD COLUMN needs_review integer CHECK (needs_review >= 0),
  ADD COLUMN reasons jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN requested_by uuid REFERENCES profiles,
  ADD COLUMN requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN completed_at timestamptz,
  ADD CONSTRAINT completed_has_outcome CHECK (status <> 'COMPLETED' OR (core_state IS NOT NULL AND completed_at IS NOT NULL));
ALTER TABLE verification_transactions ALTER COLUMN mahasetu_student_id DROP DEFAULT;
-- At most one attempt may be waiting for the applicant at a time.
CREATE UNIQUE INDEX one_awaiting_verification ON verification_transactions (application_id) WHERE status = 'AWAITING';
