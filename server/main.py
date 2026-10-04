import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote

import bcrypt as _bcrypt
import boto3
import jwt
from botocore.client import Config
from botocore.exceptions import ClientError, EndpointConnectionError
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

load_dotenv()

# ── Configuration ──────────────────────────────────────────────────────────────
ENDPOINT = os.getenv("RUSTFS_ENDPOINT", "http://localhost:9000").rstrip("/")
PUBLIC_ENDPOINT = os.getenv("RUSTFS_PUBLIC_ENDPOINT", "http://localhost:9000").rstrip("/")
REGION = os.getenv("RUSTFS_REGION", "us-east-1")
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGO = "HS256"
DB_PATH = os.getenv("DB_PATH", "users.db")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# ── S3 clients ─────────────────────────────────────────────────────────────────
def _make_client(endpoint: str):
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.getenv("RUSTFS_ACCESS_KEY", "rustfsadmin"),
        aws_secret_access_key=os.getenv("RUSTFS_SECRET_KEY", "rustfsadmin"),
        region_name=REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )

s3 = _make_client(ENDPOINT)
signer = _make_client(PUBLIC_ENDPOINT)

# ── Password hashing ───────────────────────────────────────────────────────────
def _hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

def _verify(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())

# ── SQLite database ────────────────────────────────────────────────────────────
def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _init_db() -> None:
    db = _db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT    UNIQUE NOT NULL,
            password_hash   TEXT    NOT NULL,
            role            TEXT    NOT NULL DEFAULT 'user',
            full_name       TEXT    DEFAULT '',
            email           TEXT    DEFAULT '',
            allowed_buckets TEXT    DEFAULT NULL,
            active          INTEGER NOT NULL DEFAULT 1,
            created_at      TEXT    NOT NULL
        )
    """)
    db.commit()
    if not db.execute("SELECT 1 FROM users WHERE role='admin' LIMIT 1").fetchone():
        db.execute(
            "INSERT INTO users (username, password_hash, role, full_name, created_at)"
            " VALUES (?,?,?,?,?)",
            (ADMIN_USERNAME, _hash(ADMIN_PASSWORD), "admin", "Administrator",
             datetime.now(timezone.utc).isoformat()),
        )
        db.commit()
    db.close()

_init_db()

# ── JWT / auth helpers ─────────────────────────────────────────────────────────
_bearer = HTTPBearer(auto_error=False)

def _create_token(user_id: int, username: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=24)
    return jwt.encode({"sub": str(user_id), "username": username, "role": role, "exp": exp},
                      JWT_SECRET, algorithm=JWT_ALGO)

def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def _resolve_user(token: str) -> dict:
    payload = _decode_token(token)
    db = _db()
    row = db.execute("SELECT * FROM users WHERE id=? AND active=1", (int(payload["sub"]),)).fetchone()
    db.close()
    if not row:
        raise HTTPException(401, "User not found or disabled")
    return dict(row)

def current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    return _resolve_user(creds.credentials)

def admin_required(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user

def bucket_manager_required(user: dict = Depends(current_user)) -> dict:
    """Admin OR user with unrestricted bucket access (allowed_buckets=null)."""
    if user["role"] == "admin":
        return user
    if user.get("allowed_buckets") is None:
        return user
    raise HTTPException(403, "Creating or deleting buckets requires admin or unrestricted bucket access")

def _bucket_access(bucket: str, user: dict) -> None:
    if user["role"] == "admin":
        return
    raw = user.get("allowed_buckets")
    if raw is None:
        return  # NULL means unrestricted
    if bucket not in json.loads(raw):
        raise HTTPException(403, f"Access to bucket '{bucket}' is not permitted")

# ── S3 error guard ─────────────────────────────────────────────────────────────
_S3_STATUS = {
    "BucketAlreadyOwnedByYou": 409, "BucketAlreadyExists": 409,
    "BucketNotEmpty": 409, "NoSuchBucket": 404, "NoSuchKey": 404,
}

@contextmanager
def _guard():
    try:
        yield
    except EndpointConnectionError:
        raise HTTPException(503, "Cannot reach RustFS — check it is running and the endpoint is correct.")
    except ClientError as exc:
        err = exc.response["Error"]
        code = err.get("Code", "")
        raise HTTPException(_S3_STATUS.get(code, 400), err.get("Message") or code or "S3 request failed")

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="RustFS Console API", version="2.0.0")

# ── Pydantic models ────────────────────────────────────────────────────────────
class LoginIn(BaseModel):
    username: str
    password: str

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"
    full_name: str = ""
    email: str = ""
    allowed_buckets: Optional[list] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    allowed_buckets: Optional[list] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class BucketIn(BaseModel):
    name: str

class VersioningIn(BaseModel):
    enabled: bool

class PolicyIn(BaseModel):
    public: bool

class FolderIn(BaseModel):
    prefix: str

class CopyIn(BaseModel):
    source_key: str
    dest_key: str

class BulkDeleteIn(BaseModel):
    keys: list[str]

class TransferIn(BaseModel):
    src_bucket: str
    src_key: str
    dest_bucket: str
    dest_key: str
    move: bool = False

# ── Helper: serialise a user row ───────────────────────────────────────────────
def _user_out(row) -> dict:
    d = dict(row) if isinstance(row, sqlite3.Row) else row
    return {
        "id": d["id"],
        "username": d["username"],
        "role": d["role"],
        "full_name": d.get("full_name") or "",
        "email": d.get("email") or "",
        "allowed_buckets": json.loads(d["allowed_buckets"]) if d.get("allowed_buckets") else None,
        "active": bool(d.get("active", 1)),
        "created_at": d.get("created_at", ""),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Auth
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/login")
def login(body: LoginIn):
    db = _db()
    row = db.execute("SELECT * FROM users WHERE username=? AND active=1", (body.username,)).fetchone()
    db.close()
    if not row or not _verify(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    return {"token": _create_token(row["id"], row["username"], row["role"]), "user": _user_out(row)}

@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return _user_out(user)

@app.post("/api/auth/change-password")
def change_password(body: ChangePasswordIn, user: dict = Depends(current_user)):
    if not _verify(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    db = _db()
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (_hash(body.new_password), user["id"]))
    db.commit()
    db.close()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# User management (admin only)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/users")
def list_users(_: dict = Depends(admin_required)):
    db = _db()
    rows = db.execute(
        "SELECT id,username,role,full_name,email,allowed_buckets,active,created_at FROM users ORDER BY id"
    ).fetchall()
    db.close()
    return [_user_out(r) for r in rows]

@app.post("/api/users", status_code=201)
def create_user(body: UserCreate, _: dict = Depends(admin_required)):
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if body.role not in ("admin", "user"):
        raise HTTPException(400, "Role must be 'admin' or 'user'")
    db = _db()
    try:
        db.execute(
            "INSERT INTO users (username,password_hash,role,full_name,email,allowed_buckets,created_at)"
            " VALUES (?,?,?,?,?,?,?)",
            (body.username, _hash(body.password), body.role,
             body.full_name, body.email,
             json.dumps(body.allowed_buckets) if body.allowed_buckets is not None else None,
             datetime.now(timezone.utc).isoformat()),
        )
        db.commit()
        row = db.execute("SELECT * FROM users WHERE username=?", (body.username,)).fetchone()
        return _user_out(row)
    except sqlite3.IntegrityError:
        raise HTTPException(409, f"Username '{body.username}' already exists")
    finally:
        db.close()

@app.patch("/api/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, _: dict = Depends(admin_required)):
    db = _db()
    if not db.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
        db.close()
        raise HTTPException(404, "User not found")
    sets, vals = [], []
    fields = body.model_fields_set
    if "full_name" in fields:
        sets.append("full_name=?"); vals.append(body.full_name or "")
    if "email" in fields:
        sets.append("email=?"); vals.append(body.email or "")
    if "role" in fields and body.role is not None:
        if body.role not in ("admin", "user"):
            raise HTTPException(400, "Role must be 'admin' or 'user'")
        sets.append("role=?"); vals.append(body.role)
    if "allowed_buckets" in fields:
        # None → remove restriction (NULL in DB); list → restrict to those buckets
        sets.append("allowed_buckets=?")
        vals.append(json.dumps(body.allowed_buckets) if body.allowed_buckets is not None else None)
    if "active" in fields and body.active is not None:
        sets.append("active=?"); vals.append(1 if body.active else 0)
    if "password" in fields and body.password:
        if len(body.password) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")
        sets.append("password_hash=?"); vals.append(_hash(body.password))
    if sets:
        db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=?", vals + [user_id])
        db.commit()
    row = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    db.close()
    return _user_out(row)

@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: int, admin: dict = Depends(admin_required)):
    if admin["id"] == user_id:
        raise HTTPException(400, "You cannot delete your own account")
    db = _db()
    db.execute("DELETE FROM users WHERE id=?", (user_id,))
    db.commit()
    db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# Server info
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/server/info")
def server_info(_: dict = Depends(admin_required)):
    info: dict = {"endpoint": PUBLIC_ENDPOINT, "region": REGION,
                  "bucket_count": 0, "total_objects": 0, "total_size": 0}
    try:
        with _guard():
            buckets = s3.list_buckets().get("Buckets", [])
        info["bucket_count"] = len(buckets)
        for b in buckets:
            for page in s3.get_paginator("list_objects_v2").paginate(Bucket=b["Name"]):
                for obj in page.get("Contents", []):
                    info["total_objects"] += 1
                    info["total_size"] += obj["Size"]
    except Exception as exc:
        info["error"] = str(exc)
    return info


# ═══════════════════════════════════════════════════════════════════════════════
# Buckets
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/buckets")
def list_buckets(user: dict = Depends(current_user)):
    with _guard():
        all_b = [{"name": b["Name"], "created": b["CreationDate"].isoformat()}
                 for b in s3.list_buckets().get("Buckets", [])]
    if user["role"] != "admin":
        raw = user.get("allowed_buckets")
        if raw is not None:
            allowed = set(json.loads(raw))
            all_b = [b for b in all_b if b["name"] in allowed]
    return all_b

@app.post("/api/buckets", status_code=201)
def create_bucket(body: BucketIn, _: dict = Depends(bucket_manager_required)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Bucket name is required")
    with _guard():
        s3.create_bucket(Bucket=name)
    return {"name": name}

@app.delete("/api/buckets/{bucket}", status_code=204)
def delete_bucket(bucket: str, _: dict = Depends(bucket_manager_required)):
    with _guard():
        s3.delete_bucket(Bucket=bucket)

@app.get("/api/buckets/{bucket}/stats")
def bucket_stats(bucket: str, user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    count = size = 0
    with _guard():
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
            for o in page.get("Contents", []):
                count += 1; size += o["Size"]
    return {"objects": count, "size": size, "region": REGION,
            "s3_uri": f"s3://{bucket}", "url": f"{PUBLIC_ENDPOINT}/{bucket}"}

@app.get("/api/buckets/{bucket}/versioning")
def get_versioning(bucket: str, _: dict = Depends(admin_required)):
    with _guard():
        resp = s3.get_bucket_versioning(Bucket=bucket)
    return {"status": resp.get("Status", "Disabled")}

@app.put("/api/buckets/{bucket}/versioning")
def set_versioning(bucket: str, body: VersioningIn, _: dict = Depends(admin_required)):
    status = "Enabled" if body.enabled else "Suspended"
    with _guard():
        s3.put_bucket_versioning(Bucket=bucket, VersioningConfiguration={"Status": status})
    return {"status": status}

@app.get("/api/buckets/{bucket}/policy")
def get_policy(bucket: str, _: dict = Depends(admin_required)):
    try:
        with _guard():
            resp = s3.get_bucket_policy(Bucket=bucket)
        return {"policy": json.loads(resp["Policy"]), "public": True}
    except ClientError as exc:
        if exc.response["Error"]["Code"] in ("NoSuchBucketPolicy",):
            return {"policy": None, "public": False}
        raise HTTPException(400, exc.response["Error"].get("Message", "Policy error"))
    except HTTPException as exc:
        if exc.status_code == 404:
            return {"policy": None, "public": False}
        raise

@app.put("/api/buckets/{bucket}/policy")
def set_policy(bucket: str, body: PolicyIn, _: dict = Depends(admin_required)):
    if body.public:
        policy = json.dumps({
            "Version": "2012-10-17",
            "Statement": [{"Effect": "Allow", "Principal": "*",
                           "Action": ["s3:GetObject"],
                           "Resource": [f"arn:aws:s3:::{bucket}/*"]}],
        })
        with _guard():
            s3.put_bucket_policy(Bucket=bucket, Policy=policy)
    else:
        try:
            with _guard():
                s3.delete_bucket_policy(Bucket=bucket)
        except (HTTPException, ClientError):
            pass
    return {"public": body.public}


# ═══════════════════════════════════════════════════════════════════════════════
# Objects
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/buckets/{bucket}/objects")
def list_objects(bucket: str, prefix: str = "", delimiter: str = "",
                 user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    files, folders = [], []
    with _guard():
        kwargs: dict = {"Bucket": bucket, "Prefix": prefix}
        if delimiter:
            kwargs["Delimiter"] = delimiter
        for page in s3.get_paginator("list_objects_v2").paginate(**kwargs):
            files += [{"key": o["Key"], "size": o["Size"],
                       "modified": o["LastModified"].isoformat(), "type": "file"}
                      for o in page.get("Contents", [])]
            if delimiter:
                folders += [{"key": p["Prefix"], "size": 0, "modified": "", "type": "folder"}
                            for p in page.get("CommonPrefixes", [])]
    return {"files": files, "folders": folders}

@app.post("/api/buckets/{bucket}/objects", status_code=201)
def upload_object(bucket: str, file: UploadFile = File(...), prefix: str = Form(""),
                  user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    key = f"{prefix.strip().strip('/')}/{file.filename}".lstrip("/")
    with _guard():
        s3.upload_fileobj(file.file, bucket, key,
                          ExtraArgs={"ContentType": file.content_type or "application/octet-stream"})
    return {"key": key}

@app.delete("/api/buckets/{bucket}/objects", status_code=204)
def delete_object(bucket: str, key: str, user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    with _guard():
        s3.delete_object(Bucket=bucket, Key=key)

@app.post("/api/buckets/{bucket}/objects/bulk-delete")
def bulk_delete(bucket: str, body: BulkDeleteIn, user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    with _guard():
        resp = s3.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": k} for k in body.keys], "Quiet": True},
        )
    errors = resp.get("Errors", [])
    return {"deleted": len(body.keys) - len(errors), "errors": errors}

@app.post("/api/buckets/{bucket}/folders", status_code=201)
def create_folder(bucket: str, body: FolderIn, user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    key = body.prefix.strip().rstrip("/") + "/"
    with _guard():
        s3.put_object(Bucket=bucket, Key=key, Body=b"")
    return {"key": key}

@app.post("/api/buckets/{bucket}/objects/copy")
def copy_object(bucket: str, body: CopyIn, user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    with _guard():
        s3.copy_object(Bucket=bucket,
                       CopySource={"Bucket": bucket, "Key": body.source_key},
                       Key=body.dest_key)
    return {"key": body.dest_key}

@app.post("/api/transfer", status_code=200)
def transfer_object(body: TransferIn, user: dict = Depends(current_user)):
    _bucket_access(body.src_bucket, user)
    _bucket_access(body.dest_bucket, user)
    with _guard():
        s3.copy_object(
            Bucket=body.dest_bucket,
            CopySource={"Bucket": body.src_bucket, "Key": body.src_key},
            Key=body.dest_key,
        )
        if body.move:
            s3.delete_object(Bucket=body.src_bucket, Key=body.src_key)
    return {"key": body.dest_key}

@app.get("/api/buckets/{bucket}/download")
def download_object(bucket: str, key: str, inline: bool = False,
                    token: Optional[str] = None,
                    creds: HTTPAuthorizationCredentials = Depends(_bearer)):
    raw_token = (creds.credentials if creds else None) or token
    if not raw_token:
        raise HTTPException(401, "Not authenticated")
    user = _resolve_user(raw_token)
    _bucket_access(bucket, user)
    with _guard():
        obj = s3.get_object(Bucket=bucket, Key=key)
    name = quote(key.rsplit("/", 1)[-1])
    ctype = obj.get("ContentType", "application/octet-stream")
    headers = {"Content-Disposition": f"{'inline' if inline else 'attachment'}; filename*=UTF-8''{name}"}
    if inline:
        headers["X-Content-Type-Options"] = "nosniff"
        if ctype != "application/pdf":
            headers["Content-Security-Policy"] = "sandbox"
        if ctype.split(";")[0] in ("text/html", "application/xhtml+xml"):
            ctype = "text/plain"
    return StreamingResponse(obj["Body"].iter_chunks(), media_type=ctype, headers=headers)

@app.get("/api/buckets/{bucket}/info")
def object_info(bucket: str, key: str, user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    with _guard():
        h = s3.head_object(Bucket=bucket, Key=key)
    return {
        "key": key,
        "size": h["ContentLength"],
        "content_type": h.get("ContentType", "application/octet-stream"),
        "modified": h["LastModified"].isoformat(),
        "etag": h.get("ETag", "").strip('"'),
        "storage_class": h.get("StorageClass", "STANDARD"),
        "metadata": h.get("Metadata", {}),
        "s3_uri": f"s3://{bucket}/{key}",
        "url": f"{PUBLIC_ENDPOINT}/{bucket}/{quote(key)}",
    }

@app.get("/api/buckets/{bucket}/presign")
def presign(bucket: str, key: str, expires: int = 3600, user: dict = Depends(current_user)):
    _bucket_access(bucket, user)
    expires = max(60, min(expires, 604800))
    with _guard():
        url = signer.generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires
        )
    return {"url": url, "expires_in": expires}
