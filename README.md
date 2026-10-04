# RustFS Console

A small web interface for managing buckets and objects on RustFS. The project has a React + Vite frontend and a FastAPI backend that speaks to RustFS over the S3 API, keeping credentials on the server instead of exposing them to the browser.

```text
Browser (Vite / Nginx) --> FastAPI --> boto3 --> RustFS S3 API
```

## Features

- Browse and create/delete S3 buckets
- List objects within a bucket
- Upload files with optional prefix support
- Download objects and inspect metadata
- Preview file details and generate public/shareable links
- Configure a browser-visible public RustFS address separately from the internal service endpoint

## Quick start with Docker

Prerequisites:

- Docker
- Docker Compose

From the project root:

```bash
docker compose up -d --build
```

After startup:

- App: http://localhost:8080
- RustFS console: http://localhost:9001
- RustFS S3 endpoint: http://localhost:9000

The stack is defined in [docker-compose.yml](docker-compose.yml). It starts:

- `rustfs`: the RustFS object store
- `api`: the FastAPI service
- `web`: the Vite-built frontend served by Nginx

## Environment variables

Create a `.env` file in the project root if you want to override the default credentials and public endpoint:

```env
RUSTFS_ACCESS_KEY=RUSTFSADMIN01
RUSTFS_SECRET_KEY=MyStrongRustFSSecret123!
RUSTFS_REGION=us-east-1
RUSTFS_PUBLIC_ENDPOINT=http://localhost:9000
```

Notes:

- `RUSTFS_ENDPOINT` is used by the API container to reach RustFS internally (`http://rustfs:9000` by default).
- `RUSTFS_PUBLIC_ENDPOINT` is the address your browser uses for generated URLs and presigned links.
- If RustFS is not running on localhost, set `RUSTFS_PUBLIC_ENDPOINT` to the server's public hostname or IP.

## Running in development mode

### 1) Start RustFS only

```bash
docker compose up -d rustfs
```

### 2) Start the API

```bash
cd server
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows PowerShell
# .\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000.

### 3) Start the frontend

```bash
cd web
npm install
npm run dev
```

The frontend will be available at http://localhost:5173.

## Project structure

```text
.
├── docker-compose.yml
├── README.md
├── server/
│   ├── main.py
│   └── requirements.txt
├── web/
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── context.jsx
│       ├── main.jsx
│       ├── index.css
│       └── components/
└── demo/
```

The UI is organized around bucket and file management screens, with shared state in [web/src/context.jsx](web/src/context.jsx) and component-level views under [web/src/components](web/src/components).

## Notes

- The repository is meant to be a lightweight RustFS management console rather than a full production S3 admin platform.
- Credentials are injected into the FastAPI service and not sent directly from the browser.
- Data persistence for RustFS is handled by Docker volumes (`rustfs_data` and `rustfs_logs`).
