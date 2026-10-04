import os
from contextlib import contextmanager
from urllib.parse import quote

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError, EndpointConnectionError
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

ENDPOINT = os.getenv("RUSTFS_ENDPOINT", "http://localhost:9000").rstrip("/")
# Browser-reachable address, used for displayed URLs and presigned links
PUBLIC_ENDPOINT = os.getenv("RUSTFS_PUBLIC_ENDPOINT", "http://localhost:9000").rstrip("/")
REGION = os.getenv("RUSTFS_REGION", "us-east-1")


def make_client(endpoint):
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.getenv("RUSTFS_ACCESS_KEY", "rustfsadmin"),
        aws_secret_access_key=os.getenv("RUSTFS_SECRET_KEY", "rustfsadmin"),
        region_name=REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


s3 = make_client(ENDPOINT)
signer = make_client(PUBLIC_ENDPOINT)

app = FastAPI(title="RustFS API")
STATUS = {"BucketAlreadyOwnedByYou": 409, "BucketAlreadyExists": 409,
          "BucketNotEmpty": 409, "NoSuchBucket": 404, "NoSuchKey": 404, "404": 404}


@contextmanager
def guard():
    try:
        yield
    except EndpointConnectionError:
        raise HTTPException(503, "Cannot reach RustFS. Check that it is running and the endpoint is correct.")
    except ClientError as e:
        err = e.response["Error"]
        raise HTTPException(STATUS.get(err.get("Code", ""), 400), err.get("Message") or err.get("Code", "Request failed"))


class BucketIn(BaseModel):
    name: str


@app.get("/api/buckets")
def list_buckets():
    with guard():
        return [{"name": b["Name"], "created": b["CreationDate"].isoformat()}
                for b in s3.list_buckets().get("Buckets", [])]


@app.post("/api/buckets", status_code=201)
def create_bucket(body: BucketIn):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Enter a bucket name.")
    with guard():
        s3.create_bucket(Bucket=name)
    return {"name": name}


@app.delete("/api/buckets/{bucket}", status_code=204)
def delete_bucket(bucket: str):
    with guard():
        s3.delete_bucket(Bucket=bucket)


@app.get("/api/buckets/{bucket}/objects")
def list_objects(bucket: str, prefix: str = ""):
    out = []
    with guard():
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
            out += [{"key": o["Key"], "size": o["Size"], "modified": o["LastModified"].isoformat()}
                    for o in page.get("Contents", [])]
    return out


@app.post("/api/buckets/{bucket}/objects", status_code=201)
def upload_object(bucket: str, file: UploadFile = File(...), prefix: str = Form("")):
    key = f"{prefix.strip().strip('/')}/{file.filename}".lstrip("/")
    with guard():
        s3.upload_fileobj(file.file, bucket, key,
                          ExtraArgs={"ContentType": file.content_type or "application/octet-stream"})
    return {"key": key}


@app.delete("/api/buckets/{bucket}/objects", status_code=204)
def delete_object(bucket: str, key: str):
    with guard():
        s3.delete_object(Bucket=bucket, Key=key)


@app.get("/api/buckets/{bucket}/download")
def download_object(bucket: str, key: str, inline: bool = False):
    with guard():
        obj = s3.get_object(Bucket=bucket, Key=key)
    name = quote(key.rsplit("/", 1)[-1])
    ctype = obj.get("ContentType", "application/octet-stream")
    headers = {"Content-Disposition": f"{'inline' if inline else 'attachment'}; filename*=UTF-8''{name}"}
    if inline:
        # Uploaded files must never run as scripts inside the app's origin.
        headers["X-Content-Type-Options"] = "nosniff"
        if ctype != "application/pdf":
            headers["Content-Security-Policy"] = "sandbox"
        if ctype.split(";")[0] in ("text/html", "application/xhtml+xml"):
            ctype = "text/plain"
    return StreamingResponse(obj["Body"].iter_chunks(), media_type=ctype, headers=headers)


@app.get("/api/buckets/{bucket}/stats")
def bucket_stats(bucket: str):
    count = size = 0
    with guard():
        for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket):
            for o in page.get("Contents", []):
                count += 1
                size += o["Size"]
    return {"objects": count, "size": size, "region": REGION,
            "s3_uri": f"s3://{bucket}", "url": f"{PUBLIC_ENDPOINT}/{bucket}"}


@app.get("/api/buckets/{bucket}/info")
def object_info(bucket: str, key: str):
    with guard():
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
def presign(bucket: str, key: str, expires: int = 3600):
    expires = max(60, min(expires, 604800))
    with guard():
        url = signer.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires)
    return {"url": url, "expires_in": expires}
