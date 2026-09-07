# ERP / Product Management — Setup & Deployment Guide

## 1. What this project is made of

| Piece | Tech | Where |
|---|---|---|
| Backend API | NestJS 10 + TypeORM + MySQL 8, JWT auth, Swagger | `backend/` |
| Frontend SPA | React 18 + Vite + Tailwind + React Router, served by nginx in Docker | `frontend/` |
| Background jobs | **BullMQ + Redis** (PDF generation, audit log, email) — optional, `QUEUE_ENABLED` | `backend/src/queue/` |
| Containers | Multi-stage Dockerfiles for backend and frontend | `backend/Dockerfile`, `frontend/Dockerfile` |
| Local orchestration | Docker Compose (mysql, redis, backend, frontend) | `docker-compose.yml` |
| Kubernetes | Raw manifests (`kubectl apply -k k8s/`) | `k8s/` |
| Kubernetes (packaged) | Helm chart | `helm/erp-chart/` |
| CI/CD | GitHub Actions: CI (typecheck + build + docker build), Release (push images to GHCR on tags) | `.github/workflows/` |

**There is no Kafka** in this project — messaging is Redis/BullMQ only. No message broker other than Redis is used.

## 2. What was wrong and what I fixed

1. **Backend Docker image could not build** — the production-deps stage ran `npm ci --omit=dev`, but the backend has no `package-lock.json` (only `bun.lock`), so `npm ci` errors out. Added an `|| npm install --omit=dev` fallback and a comment. Also raised the healthcheck `start-period` so the container isn't marked unhealthy while TypeORM syncs the schema on first boot.
2. **No CI/CD existed at all** — added `.github/workflows/ci.yml` (backend + frontend typecheck/build, then Docker image builds with layer caching) and `.github/workflows/release.yml` (builds and pushes both images to GHCR on `v*` tags).
3. **Compose was missing Redis/queue env** — `QUEUE_PREFIX`, `REDIS_PASSWORD`, `REDIS_DB` and `DB_USERNAME` were never passed to the backend container, so overriding them in `.env` did nothing. Added them, plus stable `container_name`s and a published Redis port (6379) so you can inspect the queue locally.
4. **No root `.env.example`** — Compose interpolates a dozen `${VARS}` that were undocumented. Added `.env.example` at the repo root.
5. **No kustomization** — added `k8s/kustomization.yaml` so the whole stack applies with one command in the right order.

Already correct (checked, no change needed): the nginx SPA config and `/api` proxy, the `backend` alias Service in both `k8s/` and the Helm chart (so the baked-in `backend:3000` upstream resolves in-cluster too), health/liveness/readiness probes against `/api/v1/health` and `/api/v1/health/live`, PVCs for MySQL data and `/app/uploads`, and the ingress routing `/api` → backend, `/` → frontend.

---

## 3. Database name

Use **`product_management`** everywhere (it's the default in `.env.example`, Compose, k8s ConfigMap and the Helm values). Do not invent a different one — the backend reads `DB_DATABASE` and TypeORM creates all tables inside it automatically.

---

## 4. Running everything with Docker (recommended)

### 4.1 Create the env file

```bash
cp .env.example .env
```

Then edit `.env`. For a normal local run only these matter:

```
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=product_management
DB_SYNC=true
JWT_SECRET=some-long-random-string
CORS_ORIGIN=http://localhost:8080
QUEUE_ENABLED=true
VITE_API_URL=/api/v1
```

> Keep `VITE_API_URL=/api/v1` for Docker. The frontend container's nginx proxies `/api` to the backend container, so the browser never needs to know the backend host.

You do **not** need `backend/.env` when running under Docker — Compose injects everything. You only need it for the local (non-Docker) run described in section 6.

### 4.2 Start

```bash
docker compose up -d --build
```

First boot takes a couple of minutes: MySQL initialises, then the backend starts and TypeORM creates every table (`DB_SYNC=true`).

### 4.3 URLs

| What | URL |
|---|---|
| App (frontend) | http://localhost:8080 |
| API | http://localhost:3000/api/v1 |
| Swagger docs | http://localhost:3000/api/docs |
| Health check | http://localhost:3000/api/v1/health |
| MySQL (from host) | `localhost:3307` |
| Redis (from host) | `localhost:6379` |

### 4.4 Useful commands

```bash
docker compose ps                 # status of all 4 containers
docker compose logs -f backend    # follow backend logs
docker compose restart backend
docker compose down               # stop (keeps data)
docker compose down -v            # stop AND delete DB/redis/uploads volumes
docker compose up -d --build backend   # rebuild just the backend after code changes
```

### 4.5 Create the first user

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","name":"Admin","password":"Admin@123"}'
```

Then log in at http://localhost:8080.

---

## 5. Connecting MySQL Workbench to the Docker database

The container's MySQL listens on 3306 internally, but Compose publishes it on **host port 3307** so it never clashes with a MySQL you may already have installed locally.

1. Open MySQL Workbench → click the **+** next to "MySQL Connections".
2. Fill in:
   - **Connection Name:** `ERP Docker`
   - **Connection Method:** `Standard (TCP/IP)`
   - **Hostname:** `127.0.0.1`  (use the IP, not `localhost` — Workbench sometimes maps `localhost` to a socket)
   - **Port:** `3307`
   - **Username:** `root`
   - **Password:** click *Store in Vault…* and enter the `DB_PASSWORD` from your `.env` (default `root`)
   - **Default Schema:** `product_management`
3. Click **Test Connection** → you should get "Successfully made the MySQL connection".
4. **OK** to save, then double-click the connection. Expand **Schemas → product_management → Tables** to see `users`, `products`, `stock`, `sales_orders`, `employees`, etc.

Troubleshooting:
- *Can't connect to MySQL server on 127.0.0.1:3307* → the DB container isn't up yet: `docker compose ps` and wait for `healthy`.
- *Authentication plugin cannot be loaded* → you're on an old Workbench; the container already starts with `--default-authentication-plugin=mysql_native_password`, so upgrade Workbench to 8.0.30+.
- *Unknown database 'product_management'* → your `.env` set a different `DB_DATABASE`; either fix `.env` and run `docker compose down -v && docker compose up -d`, or point Workbench at the name you used.
- Prefer the CLI? `docker compose exec db mysql -uroot -proot product_management`

---

## 6. Running locally without Docker (your current workflow, kept working)

You still need MySQL and (optionally) Redis running on your machine.

### 6.1 Database

Either use the Docker DB only:

```bash
docker compose up -d db redis
```

…and point the backend at port **3307**, or use a locally installed MySQL on 3306 and create the schema once:

```sql
CREATE DATABASE product_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 6.2 Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

`backend/.env` for the "Docker DB + local Nest" combo:

```
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3307          # use 3306 if MySQL is installed natively
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=product_management
DB_SYNC=true
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=10m
KSA_COMPANY_PREFIX=6281234
MAX_UPLOAD_MB=10
QUEUE_ENABLED=false   # set true only if Redis is reachable
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
PUBLIC_API_URL=http://localhost:3000
API_PREFIX=api/v1
CORS_ORIGIN=http://localhost:5173
```

### 6.3 Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

`frontend/.env` for local dev (the backend is on another port, so the full URL is required):

```
VITE_API_URL=http://localhost:3000/api/v1
```

Open http://localhost:5173.

> Note: `QUEUE_ENABLED=false` makes every enqueue a logged no-op, so the app runs fine with no Redis at all.

---

## 7. Kubernetes / Helm (for later)

Raw manifests:

```bash
# edit k8s/secrets.yaml and k8s/configmap.yaml first (host, passwords, image repos)
kubectl apply -k k8s/
kubectl get pods -w
```

Helm:

```bash
helm upgrade --install erp ./helm/erp-chart \
  --set backend.image.repository=ghcr.io/<you>/<repo>-backend \
  --set frontend.image.repository=ghcr.io/<you>/<repo>-frontend \
  --set ingress.host=erp.yourdomain.com \
  --set secrets.DB_PASSWORD='...' --set secrets.MYSQL_ROOT_PASSWORD='...' \
  --set secrets.JWT_SECRET='...'
```

In production keep `DB_SYNC: "false"` (already the default in the ConfigMap/values) and manage schema changes with TypeORM migrations, and replace the plain Secret with a SealedSecret or External Secret.

---

## 8. Quick sanity checklist

```bash
curl http://localhost:3000/api/v1/health        # {"status":"ok","database":"up",...}
curl http://localhost:8080/healthz              # ok
docker compose exec redis redis-cli ping        # PONG
docker compose exec db mysql -uroot -proot -e "SHOW DATABASES;"
```
