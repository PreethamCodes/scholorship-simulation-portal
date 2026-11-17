SET LOCAL search_path TO scholarship, pg_catalog;

-- Inputs the portal passes to MahaSetu when it launches a verification.
-- The MahaSetu student ID links the applicant to department records. The mobile number receives
-- one-time codes and result messages. Both are synthetic in this demonstration.
ALTER TABLE scholarship_applications
  ADD COLUMN mahasetu_student_id text CHECK (mahasetu_student_id ~ '^MHSTU[0-9]{4}$'),
  ADD COLUMN applicant_mobile text CHECK (applicant_mobile ~ '^[6-9][0-9]{9}$');
