CREATE SCHEMA IF NOT EXISTS scholarship;
SET LOCAL search_path TO scholarship, pg_catalog;
CREATE ROLE scholarship_runtime NOLOGIN;
REVOKE ALL ON SCHEMA scholarship FROM PUBLIC;
GRANT USAGE ON SCHEMA scholarship TO scholarship_runtime;

CREATE TABLE profiles (
    id uuid primary key,
    display_name text not null
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON profiles TO scholarship_runtime;
CREATE POLICY service_access ON profiles TO scholarship_runtime USING (true) WITH CHECK (true);

CREATE TABLE student_profiles (
    student_ref text primary key,
    user_id uuid unique not null references profiles,
    academic_year int not null
);
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON student_profiles TO scholarship_runtime;
CREATE POLICY service_access ON student_profiles TO scholarship_runtime USING (true) WITH CHECK (true);

CREATE TABLE scholarship_applications (
    id uuid primary key default gen_random_uuid(),
    student_ref text not null references student_profiles,
    scheme_id text not null,
    application_year int not null,
    academic_reference text,
    status text not null default 'DRAFT',
    unique(student_ref,scheme_id,application_year)
);
ALTER TABLE scholarship_applications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON scholarship_applications TO scholarship_runtime;
CREATE POLICY service_access ON scholarship_applications TO scholarship_runtime USING (true) WITH CHECK (true);
CREATE INDEX ON scholarship_applications (student_ref);

CREATE TABLE application_documents (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references scholarship_applications,
    object_path text unique not null
);
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON application_documents TO scholarship_runtime;
CREATE POLICY service_access ON application_documents TO scholarship_runtime USING (true) WITH CHECK (true);
CREATE INDEX ON application_documents (application_id);

CREATE TABLE application_status_history (
    id bigint generated always as identity primary key,
    application_id uuid not null references scholarship_applications,
    status text not null,
    recorded_at timestamptz not null default now()
);
ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON application_status_history TO scholarship_runtime;
CREATE POLICY service_access ON application_status_history TO scholarship_runtime USING (true) WITH CHECK (true);
CREATE INDEX ON application_status_history (application_id);

CREATE TABLE verification_transactions (
    transaction_ref uuid primary key,
    application_id uuid not null references scholarship_applications,
    permitted_result text
);
ALTER TABLE verification_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON verification_transactions TO scholarship_runtime;
CREATE POLICY service_access ON verification_transactions TO scholarship_runtime USING (true) WITH CHECK (true);
CREATE INDEX ON verification_transactions (application_id);

CREATE TABLE officer_reviews (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references scholarship_applications,
    officer_id uuid not null references profiles,
    recommendation text not null check (recommendation in ('APPROVE','REJECT','MANUAL_REVIEW')),
    reviewed_at timestamptz not null default now()
);
ALTER TABLE officer_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON officer_reviews TO scholarship_runtime;
CREATE POLICY service_access ON officer_reviews TO scholarship_runtime USING (true) WITH CHECK (true);
CREATE INDEX ON officer_reviews (application_id);
CREATE INDEX ON officer_reviews (officer_id);
GRANT USAGE ON ALL SEQUENCES IN SCHEMA scholarship TO scholarship_runtime;
INSERT INTO storage.buckets (id,name,public) VALUES ('scholarship-documents','scholarship-documents',false);
GRANT USAGE ON SCHEMA storage TO scholarship_runtime;
GRANT SELECT, INSERT ON storage.objects TO scholarship_runtime;
CREATE POLICY scholarship_read ON storage.objects FOR SELECT TO scholarship_runtime USING (bucket_id='scholarship-documents');
CREATE POLICY scholarship_upload ON storage.objects FOR INSERT TO scholarship_runtime WITH CHECK (bucket_id='scholarship-documents');
