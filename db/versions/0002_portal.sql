SET LOCAL search_path TO scholarship, pg_catalog;

-- Auth owns identities. Only a migration administrator can provision an officer.
CREATE TABLE officer_accounts (user_id uuid PRIMARY KEY);
ALTER TABLE officer_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON officer_accounts TO scholarship_runtime;
CREATE POLICY officer_membership ON officer_accounts FOR SELECT TO scholarship_runtime USING (true);

ALTER TABLE student_profiles ADD COLUMN district text NOT NULL DEFAULT '';
ALTER TABLE scholarship_applications
  ADD COLUMN institution text NOT NULL DEFAULT '',
  ADD COLUMN programme text NOT NULL DEFAULT '',
  ADD COLUMN annual_income numeric(12,2) CHECK (annual_income >= 0),
  ADD COLUMN applicant_name text,
  ADD COLUMN applicant_district text,
  ADD COLUMN verification_status text NOT NULL DEFAULT 'NOT_REQUESTED'
    CHECK (verification_status IN ('NOT_REQUESTED','AWAITING_EXTERNAL_VERIFICATION')),
  ADD COLUMN revision integer NOT NULL DEFAULT 0,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT application_state CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','ADDITIONAL_INFORMATION_REQUIRED','RESUBMITTED','RECOMMENDED','REJECTED'));
CREATE INDEX application_queue ON scholarship_applications (status, updated_at DESC);
ALTER TABLE application_documents ADD COLUMN filename text NOT NULL DEFAULT 'Document',
  ADD COLUMN media_type text NOT NULL DEFAULT 'application/octet-stream',
  ADD COLUMN uploaded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN removed_at timestamptz;
ALTER TABLE application_status_history ADD COLUMN actor_id uuid REFERENCES profiles,
  ADD COLUMN event text NOT NULL DEFAULT 'Status recorded',
  ADD COLUMN note text NOT NULL DEFAULT '';
ALTER TABLE officer_reviews ADD COLUMN note text NOT NULL DEFAULT '';
