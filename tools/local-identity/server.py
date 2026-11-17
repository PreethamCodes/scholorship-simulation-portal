"""Local stand-in for the Supabase Auth and Storage calls the Scholarship portal makes. LAPTOP DEMONSTRATIONS ONLY.

It implements just the subset the portal uses, so a demonstration needs no hosted project:

  POST /auth/v1/signup                 register {email, password, data}
  POST /auth/v1/token?grant_type=password
  GET  /auth/v1/user                   the signed-in user for a bearer token
  POST /auth/v1/logout
  POST|GET /storage/v1/object/<bucket>/<path>   private document bytes (service key only)

Settings (environment): LOCAL_IDENTITY_PUBLISHABLE_KEY and LOCAL_IDENTITY_STORAGE_KEY (24+ characters each, required),
LOCAL_IDENTITY_DATA (directory for users and documents, default /data), PORT (default 9999), SESSION_SECONDS (default 3600).
Passwords are stored as salted scrypt hashes. Sessions and uploaded documents live under LOCAL_IDENTITY_DATA.
There is no email verification, rate limiting or password reset: never expose this service beyond loopback or use real data.
"""
import hashlib
import hmac
import json
import os
import secrets
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

NAMESPACE = uuid.UUID("5d0b2a52-7f4d-4f0e-9f6a-3f9c1c0b7a11")
MAX_BODY = 12 * 1024 * 1024
LOCK = threading.Lock()


class Store:
    """Users as one JSON file (atomic replace); documents as files named by the hash of their path."""

    def __init__(self, root: Path):
        self.root = root
        self.users_file = root / "users.json"
        self.objects = root / "objects"
        self.objects.mkdir(parents=True, exist_ok=True)
        self.users = json.loads(self.users_file.read_text("utf-8")) if self.users_file.is_file() else {}
        self.tokens: dict[str, tuple[str, float]] = {}

    def save_users(self):
        temporary = self.users_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.users), "utf-8")
        os.replace(temporary, self.users_file)

    def object_file(self, path: str) -> Path:
        return self.objects / hashlib.sha256(path.encode()).hexdigest()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return salt.hex() + "$" + digest.hex()


def password_matches(password: str, stored: str) -> bool:
    salt, _, digest = stored.partition("$")
    return hmac.compare_digest(hash_password(password, bytes.fromhex(salt)).partition("$")[2], digest)


def make_handler(store: Store, publishable: str, storage: str, session_seconds: int):
    class Handler(BaseHTTPRequestHandler):
        server_version = "local-identity"

        def log_message(self, *args):
            pass

        def reply(self, status, body=None, raw=None):
            data = raw if raw is not None else (json.dumps(body).encode() if body is not None else b"")
            self.send_response(status)
            self.send_header("Content-Type", "text/plain;charset=UTF-8" if raw is not None else "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def payload(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return None
            return self.rfile.read(length) if length else b""

        def key_ok(self, expected: str) -> bool:
            return hmac.compare_digest(self.headers.get("apikey", ""), expected)

        def bearer(self) -> str:
            return self.headers.get("Authorization", "").partition(" ")[2]

        def session_user(self):
            record = store.tokens.get(self.bearer())
            if not record or record[1] < time.time():
                return None
            return store.users.get(record[0])

        def session_for(self, user):
            token = secrets.token_urlsafe(32)
            store.tokens[token] = (user["email"], time.time() + session_seconds)
            return {"access_token": token, "expires_in": session_seconds, "token_type": "bearer",
                    "user": {"id": user["id"], "email": user["email"], "user_metadata": user["meta"]}}

        def do_GET(self):
            url = urlsplit(self.path)
            if url.path == "/health":
                return self.reply(200, {"status": "ok"})
            if url.path == "/auth/v1/user":
                if not self.key_ok(publishable):
                    return self.reply(401, {"msg": "invalid key"})
                with LOCK:
                    user = self.session_user()
                if not user:
                    return self.reply(401, {"msg": "invalid session"})
                return self.reply(200, {"id": user["id"], "email": user["email"], "user_metadata": user["meta"]})
            if url.path.startswith("/storage/v1/object/"):
                if not self.key_ok(storage):
                    return self.reply(401, {"msg": "invalid key"})
                file = store.object_file(unquote(url.path))
                return self.reply(200, raw=file.read_bytes()) if file.is_file() else self.reply(404, {"msg": "not found"})
            self.reply(404, {"msg": "not found"})

        def do_POST(self):
            url = urlsplit(self.path)
            body = self.payload()
            if body is None:
                return self.reply(413, {"msg": "too large"})
            if url.path.startswith("/storage/v1/object/"):
                if not self.key_ok(storage):
                    return self.reply(401, {"msg": "invalid key"})
                store.object_file(unquote(url.path)).write_bytes(body)
                return self.reply(200, {"Key": url.path})
            if not url.path.startswith("/auth/v1/"):
                return self.reply(404, {"msg": "not found"})
            if not self.key_ok(publishable):
                return self.reply(401, {"msg": "invalid key"})
            if url.path == "/auth/v1/logout":
                with LOCK:
                    store.tokens.pop(self.bearer(), None)
                return self.reply(204)
            try:
                data = json.loads(body or b"{}")
                email = str(data["email"]).strip().lower()
                password = str(data["password"])
            except (ValueError, KeyError):
                return self.reply(400, {"msg": "email and password are required"})
            with LOCK:
                if url.path == "/auth/v1/signup":
                    if "@" not in email or len(password) < 8 or email in store.users:
                        return self.reply(422, {"msg": "cannot register with these details"})
                    meta = data.get("data") if isinstance(data.get("data"), dict) else {}
                    store.users[email] = {"id": str(uuid.uuid5(NAMESPACE, email)), "email": email,
                                          "password": hash_password(password), "meta": meta}
                    store.save_users()
                    return self.reply(200, self.session_for(store.users[email]))
                if url.path == "/auth/v1/token":
                    user = store.users.get(email)
                    if not user or not password_matches(password, user["password"]):
                        return self.reply(400, {"msg": "invalid login credentials"})
                    return self.reply(200, self.session_for(user))
            self.reply(404, {"msg": "not found"})

    return Handler


def main():
    publishable = os.environ.get("LOCAL_IDENTITY_PUBLISHABLE_KEY", "")
    storage = os.environ.get("LOCAL_IDENTITY_STORAGE_KEY", "")
    if len(publishable) < 24 or len(storage) < 24 or publishable == storage:
        sys.exit("LOCAL_IDENTITY_PUBLISHABLE_KEY and LOCAL_IDENTITY_STORAGE_KEY must be different and at least 24 characters.")
    store = Store(Path(os.environ.get("LOCAL_IDENTITY_DATA", "/data")))
    handler = make_handler(store, publishable, storage, int(os.environ.get("SESSION_SECONDS", "3600")))
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "9999"))), handler).serve_forever()


if __name__ == "__main__":
    main()
