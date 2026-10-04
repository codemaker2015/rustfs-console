# RustFS Console

A full-featured, production-ready S3 admin platform for RustFS, with a separate user portal. Built with React + Vite on the frontend and FastAPI on the backend.

```text
Browser (Vite / Nginx) --> FastAPI --> boto3 --> RustFS S3 API
```

## Features

### Admin portal
- **Dashboard** — storage stats, bucket count, object count, user count, quick actions
- **Bucket management** — create/delete buckets; toggle versioning and public-read policy per bucket
- **Object browser** — navigate folders with breadcrumbs; multi-select; bulk delete; copy objects; create folders; view/download/share files with pre-signed URLs; file preview
- **Upload center** — drag-and-drop multi-file upload with per-file progress; folder prefix support
- **User management** — create, edit, enable/disable and delete users; assign admin or user roles; restrict access to specific buckets per user
- **Settings** — server info, live storage stats, change password

### User portal
- **My Files** — browse allowed buckets with folder navigation; download files; generate share links
- **Upload** — upload files to any accessible bucket

### Authentication & security
- JWT-based login (24-hour tokens stored in `localStorage`)
- Role-based access: `admin` (full access) vs `user` (bucket-restricted)
- Bucket-level access control: restrict individual users to a subset of buckets
- Credentials never leave the server — the frontend only holds a JWT
- Token passed as a query parameter for inline file preview/download links

## Quick start with Docker

```bash
docker compose up -d --build
```

| URL | Service |
|-----|---------|
| http://localhost:8080 | RustFS Console (this app) |
| http://localhost:9001 | RustFS native console |
| http://localhost:9000 | RustFS S3 endpoint |

Default credentials: **admin / admin123** — change these immediately in production.

## Environment variables

Create a `.env` file in the project root:

```env
RUSTFS_ACCESS_KEY=RUSTFSADMIN01
RUSTFS_SECRET_KEY=MyStrongRustFSSecret123!
RUSTFS_REGION=us-east-1
RUSTFS_PUBLIC_ENDPOINT=http://localhost:9000

# Auth — set these in production
JWT_SECRET=a-long-random-secret-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=a-strong-admin-password
```

| Variable | Default | Description |
|---|---|---|
| `RUSTFS_ENDPOINT` | `http://localhost:9000` | Internal S3 endpoint used by the API container |
| `RUSTFS_PUBLIC_ENDPOINT` | `http://localhost:9000` | Browser-visible address for presigned URLs |
| `RUSTFS_ACCESS_KEY` | `rustfsadmin` | RustFS access key |
| `RUSTFS_SECRET_KEY` | `rustfsadmin` | RustFS secret key |
| `RUSTFS_REGION` | `us-east-1` | S3 region name |
| `JWT_SECRET` | random (changes on restart) | Secret for signing JWTs — **set a static value in production** |
| `ADMIN_USERNAME` | `admin` | Username for the initial admin account |
| `ADMIN_PASSWORD` | `admin123` | Password for the initial admin account |
| `DB_PATH` | `users.db` | Path to the SQLite file storing users |

## Running in development

### 1) Start RustFS

```bash
docker compose up -d rustfs
```

### 2) Start the API

```bash
cd server
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3) Start the frontend

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 and sign in with `admin / admin123`.

## Project structure

```text
.
├── docker-compose.yml
├── README.md
├── server/
│   ├── main.py          # FastAPI app — auth, user management, S3 proxy
│   ├── requirements.txt
│   └── Dockerfile
└── web/
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.js
    └── src/
        ├── App.jsx           # Role-based routing (admin / user / login)
        ├── api.js            # API client with JWT injection
        ├── context.jsx       # Auth + bucket state
        ├── index.css         # Tailwind v4 theme + utilities
        ├── main.jsx
        ├── pages/
        │   └── LoginPage.jsx
        └── components/
            ├── AdminLayout.jsx     # Sidebar layout for admin
            ├── UserLayout.jsx      # Header layout for user portal
            ├── Dashboard.jsx       # Admin overview
            ├── BucketManager.jsx   # Bucket CRUD + versioning + policy
            ├── ObjectBrowser.jsx   # Folder navigation + multi-select + bulk ops
            ├── UploadCenter.jsx    # Multi-file drag-drop upload
            ├── UserManager.jsx     # User CRUD + role + bucket access
            ├── SettingsPage.jsx    # Server info + change password
            ├── UserFiles.jsx       # User portal file browser
            ├── UserUpload.jsx      # User portal upload
            ├── StatCard.jsx        # Dashboard stat tile
            ├── Modal.jsx           # Generic overlay modal
            └── [shared components from v1]
```

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login, returns JWT + user |
| GET  | `/api/auth/me` | any | Current user info |
| POST | `/api/auth/change-password` | any | Change own password |
| GET  | `/api/users` | admin | List all users |
| POST | `/api/users` | admin | Create user |
| PATCH | `/api/users/{id}` | admin | Update user |
| DELETE | `/api/users/{id}` | admin | Delete user |
| GET  | `/api/server/info` | admin | Aggregate storage stats |
| GET  | `/api/buckets` | any | List buckets (filtered by `allowed_buckets` for users) |
| POST | `/api/buckets` | admin | Create bucket |
| DELETE | `/api/buckets/{b}` | admin | Delete bucket |
| GET  | `/api/buckets/{b}/versioning` | admin | Get versioning status |
| PUT  | `/api/buckets/{b}/versioning` | admin | Enable/suspend versioning |
| GET  | `/api/buckets/{b}/policy` | admin | Get public-access policy |
| PUT  | `/api/buckets/{b}/policy` | admin | Set public/private access |
| GET  | `/api/buckets/{b}/objects` | any | List objects (supports `prefix` and `delimiter`) |
| POST | `/api/buckets/{b}/objects` | any | Upload object |
| DELETE | `/api/buckets/{b}/objects` | any | Delete single object |
| POST | `/api/buckets/{b}/objects/bulk-delete` | any | Delete multiple objects |
| POST | `/api/buckets/{b}/objects/copy` | any | Copy object within bucket |
| POST | `/api/buckets/{b}/folders` | any | Create a folder (empty key with trailing `/`) |
| GET  | `/api/buckets/{b}/download` | any | Stream object (inline or attachment; accepts `?token=`) |
| GET  | `/api/buckets/{b}/info` | any | Object metadata |
| GET  | `/api/buckets/{b}/presign` | any | Generate a pre-signed download URL |

## Security notes

- Set a strong `JWT_SECRET` in production. Without it a new random secret is generated at startup, invalidating all sessions on restart.
- Change `ADMIN_PASSWORD` before exposing the service to the internet.
- The SQLite database (`users.db`) contains hashed passwords — keep it out of version control and back it up.
- The `download` endpoint accepts a `?token=` query param so browsers can open inline previews; use HTTPS in production to prevent token leakage.
