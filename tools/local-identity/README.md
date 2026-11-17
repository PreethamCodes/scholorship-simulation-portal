# Local identity and storage (laptop demonstrations only)

A small, dependency-free service that answers the few Supabase Auth and Storage calls the Scholarship portal makes, so the whole demonstration runs on one laptop without a hosted project. Production and shared environments keep using Supabase.

It supports registration, password sign-in, "who am I", sign-out, and private document upload and download. Users and documents are kept under `LOCAL_IDENTITY_DATA`. Passwords are stored as salted scrypt hashes. There is no email confirmation, rate limiting or password reset, so keep it on loopback and use synthetic data only.

## Run

```sh
LOCAL_IDENTITY_PUBLISHABLE_KEY=<24+ random characters> LOCAL_IDENTITY_STORAGE_KEY=<different 24+ random characters> \
LOCAL_IDENTITY_DATA=./data python server.py        # listens on :9999
```

Then point the portal at it: `SUPABASE_URL=http://localhost:9999`, `SUPABASE_PUBLISHABLE_KEY` = the first key, `SCHOLARSHIP_STORAGE_KEY` = the second. Build with `docker build -t local-identity .` in this directory. The deployment project's `local-identity` profile does all of this and generates the keys.

`GET /health` reports liveness.
