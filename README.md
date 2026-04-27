# Layer Provider

A geospatial file management platform. Upload geo files in any common format, convert them to GeoJSON, organise layers into projects and groups, and preview them on an interactive map.

## Features

- Upload **Shapefile (ZIP), GeoPackage, KML/KMZ, GPX, GML, GeoJSON**
- Automatic conversion to GeoJSON via GDAL (`ogr2ogr`)
- Multi-layer detection — choose to expand into separate layers or merge by geometry type
- Background conversion queue (Symfony Messenger + Doctrine transport)
- Layer metadata extraction (feature count, geometry type, CRS, extent, field schema)
- Interactive map preview with progressive rendering for large datasets
- Organise layers into **Projects** and **Layer Groups**
- **Merge** multiple converted layers into a single GeoJSON
- **Grid split** large GeoJSON files into spatial tiles via quadtree subdivision (≤ 5 MB per cell)
- JWT authentication (stateless, Bearer token)
- REST API with OpenAPI docs (API Platform)
- HTTPS via Traefik reverse proxy with self-signed certificates

## Stack

| Layer | Technology |
|-------|-----------|
| API | Symfony 7 · API Platform 4 · PHP 8.4 |
| Database | PostgreSQL 17 · Doctrine ORM |
| Auth | Lexik JWT Authentication |
| File upload | VichUploader |
| Geo processing | GDAL (`ogr2ogr`, `ogrinfo`) |
| Queue | Symfony Messenger · Doctrine transport |
| Frontend | Next.js 16 · React 19 · TypeScript |
| Maps | Leaflet 1.9 · react-leaflet 5 |
| Styling | Tailwind CSS 4 |
| Infrastructure | Docker Compose · Traefik · Nginx · PHP-FPM |

## Architecture

```
Browser
  │  HTTPS (443)
  ▼
Traefik (reverse proxy)
  ├── https://localhost      → client:3000  (Next.js, TLS termination)
  └── https://api.localhost  → nginx:443    (HTTPS passthrough, skipVerify)
        │  FastCGI
        ▼
PHP container
  ├── REST API (API Platform)
  ├── State processors (multipart uploads, nested relations)
  ├── ConvertLayerController (POST /api/layers/{id}/convert)
  ├── DetectLayersController (POST /api/layers/detect)
  ├── MergeLayersController  (POST /api/layers/merge)
  └── SplitLayerController   (POST /api/layers/{id}/split)

Worker container (app_worker)
  └── Messenger worker (async queue, restarts automatically)
        │  shell
        ▼
GDAL tools (ogr2ogr · ogrinfo)
        │  files
        ▼
Storage
  ├── var/private/layers/   — raw uploads (private)
  └── public/geojson/       — converted outputs (public)
```

The Messenger worker runs in a dedicated `app_worker` container. It loops with `--time-limit=3600` and a 3-second sleep between restarts, so no separate process manager is needed.

## Entities

```
Project ──< Layer
   └──< LayerGroup ──< Layer
```

- **Project** — top-level container; holds layers and groups.
- **Layer** — a geo dataset with an optional uploaded file, conversion status, GeoJSON output path, and extracted metadata. The `merged` flag marks layers created by the merge operation; `sourceLayerIris` lists the origin layers.
- **LayerGroup** — organises related layers within a project (created automatically on multi-layer conversion or grid split). Tracks `splitStatus` and optionally references the `originLayer` that was split.
- **User** — email + password; roles `ROLE_USER` / `ROLE_ADMIN`.

## Conversion pipeline

1. **Upload** a layer with a geo file → stored in `var/private/layers/`.
2. **Analyse** — click *Convert to GeoJSON* on the edit page. The server scans the file and reports how many layers it contains and their geometry types.
3. **Confirm** — for multi-layer files, choose:
   - **Separate layers** — one Layer entity per source layer.
   - **Merge by geometry type** — layers that share a geometry type are merged into one GeoJSON.
4. **Queue** — a `ConvertLayerFileMessage` is dispatched; the layer status becomes `pending`.
5. **Process** — the background worker runs `ogr2ogr`, writes output to `public/geojson/{id}.geojson`, extracts metadata, and sets status to `done` (or `error`).
6. If multiple layers were produced, a **LayerGroup** is automatically created and all produced layers are assigned to it.

## Merge pipeline

Any set of two or more converted layers can be combined into a new layer:

1. `POST /api/layers/merge` with `{ "name": "…", "layers": ["/api/layers/id1", …] }`
2. All source GeoJSON files are merged in-process (no queue) via `GeoConverterService::mergeGeoJsonFiles`.
3. A new Layer entity is created with `merged: true`, `sourceLayerIris` set, and status `done`.

## Grid split pipeline

Large layers can be split into spatial tiles for more efficient map rendering:

1. `POST /api/layers/{id}/split`
2. A `SplitLayerMessage` is dispatched; a new LayerGroup with `splitStatus: pending` is created immediately and its IRI is returned (`202`).
3. The worker runs `GeoJsonSplitterService::split`, which uses quadtree subdivision to partition features into cells ≤ 5 MB each (by centroid, no clipping or duplication).
4. One child Layer per cell is created and added to the group; `splitStatus` becomes `done`.

## Getting started

### Prerequisites

- Docker & Docker Compose
- `openssl` (for generating JWT keys and TLS certificates)

### 1. Configure environment

```bash
cp .env.example .env   # edit values as needed
```

Key variables:

```dotenv
HTTP_PORT=80
HTTPS_PORT=443
TRAEFIK_DASHBOARD_PORT=8080
POSTGRES_PASSWORD=secret
APP_SECRET=change_me_in_production
DEFAULT_URI=https://api.localhost
NEXT_PUBLIC_ENTRYPOINT=https://api.localhost
JWT_PASSPHRASE=your_passphrase
```

Both `DEFAULT_URI` and `NEXT_PUBLIC_ENTRYPOINT` must use `https://`. Using `http://` causes Traefik to issue a 308 redirect that the browser blocks due to missing CORS headers on the redirect response.

### 2. Add api.localhost to /etc/hosts

```bash
echo "127.0.0.1  api.localhost" | sudo tee -a /etc/hosts
```

On Windows, add `127.0.0.1  api.localhost` to `C:\Windows\System32\drivers\etc\hosts` as Administrator.

### 3. Generate TLS certificates

```bash
./generate-certs.sh
```

This creates a self-signed certificate in `docker/nginx/certs/` covering `localhost` and `api.localhost`.

**Trusting the certificate is required, not optional.** The frontend makes API calls via JavaScript `fetch()`. Browsers reject `fetch()` requests to HTTPS endpoints with untrusted certificates with a silent `NetworkError` — there is no click-through warning for programmatic requests. Follow the trust instructions printed by the script for your platform.

The easiest path is to install [`mkcert`](https://github.com/FiloSottile/mkcert#installation) before running the script — it handles trust automatically. If you used the OpenSSL fallback, you can also accept the cert by visiting `https://api.localhost` directly in the browser and proceeding past the warning, which adds a one-time browser exception.

### 4. Generate JWT keys

The keys must live inside `app/api/config/jwt/` — that directory is the Symfony project root inside the PHP container.

```bash
mkdir -p app/api/config/jwt
openssl genrsa -out app/api/config/jwt/private.pem -aes256 4096   # use JWT_PASSPHRASE when prompted
openssl rsa -pubout -in app/api/config/jwt/private.pem -out app/api/config/jwt/public.pem
```

Set `JWT_PASSPHRASE` in `.env` to the passphrase you chose above.

### 5. Build and start

```bash
make build
make up
```

### 6. Initialise the database

```bash
make db-create
make db-migrate
```

### 7. Create the first user

```bash
docker compose exec php php bin/console app:create-user admin@example.com password ROLE_ADMIN
```

### 8. Open

| Service | URL |
|---------|-----|
| Client | https://localhost |
| API | https://api.localhost/api |
| OpenAPI docs | https://api.localhost/api/docs |
| Traefik dashboard | http://localhost:8080 |

## Common commands

```bash
make up             # Start all containers
make down           # Stop all containers
make logs           # Tail all container logs
make shell          # Shell into the PHP container
make cc             # Clear Symfony cache
make db-diff        # Generate a migration from entity changes
make db-migrate     # Apply pending migrations
make composer cmd="require vendor/pkg"  # Run composer
```

## Monitoring the conversion queue

```bash
# Watch the worker log in real time
docker logs app_worker -f

# Inspect queued / in-flight messages
docker compose exec postgres psql -U app -d app \
  -c "SELECT id, queue_name, created_at, delivered_at FROM messenger_messages ORDER BY created_at DESC LIMIT 20;"

# Inspect failed messages (after 3 retries)
docker compose exec php php bin/console messenger:failed:show

# Retry a failed message
docker compose exec php php bin/console messenger:failed:retry
```

## API overview

All write operations require `Authorization: Bearer <token>`. Read (GET) is public.

```
POST   /api/login                    Obtain JWT token
GET    /api/projects                 List projects
POST   /api/projects                 Create project
GET    /api/layers                   List layers (filter: ?project=IRI&group=IRI)
POST   /api/layers                   Upload layer (multipart/form-data)
PATCH  /api/layers/{id}              Update layer
POST   /api/layers/{id}/convert      Trigger / confirm conversion
POST   /api/layers/detect            Detect sub-layers in a file (no upload stored)
POST   /api/layers/merge             Merge converted layers into one
POST   /api/layers/{id}/split        Split a large GeoJSON into a spatial grid (async)
GET    /api/layer_groups             List groups (filter: ?project=IRI)
POST   /api/layer_groups             Create group
```

## File structure

```
.
├── app/
│   ├── api/                   Symfony API
│   │   ├── config/            Symfony configuration
│   │   ├── migrations/        Doctrine database migrations
│   │   ├── public/            Web root (index.php, geojson output)
│   │   ├── src/
│   │   │   ├── Controller/    Custom endpoints (convert, detect, merge, split, file serve)
│   │   │   ├── Entity/        Project · Layer · LayerGroup · User
│   │   │   ├── EventListener/ LayerGeoJsonCleanupListener
│   │   │   ├── GeoConverter/  GeoConverterService · GeoJsonSplitterService
│   │   │   ├── Message/       ConvertLayerFileMessage · SplitLayerMessage
│   │   │   ├── MessageHandler/
│   │   │   ├── Repository/
│   │   │   └── State/         API Platform state processors
│   │   ├── templates/
│   │   ├── var/               Cache, logs, uploads (git-ignored)
│   │   ├── vendor/            PHP dependencies (git-ignored)
│   │   ├── composer.json
│   │   └── symfony.lock
│   └── client/                Next.js frontend
│       ├── components/        React components (forms, lists, map, auth)
│       ├── context/           AuthContext (JWT state)
│       ├── pages/             Next.js pages (projects, layers, layer-groups, map, login)
│       ├── types/             TypeScript types
│       ├── utils/             API fetch helper, Mercure, data access, auth
│       └── package.json
├── docker/
│   ├── nginx/
│   │   ├── default.conf       HTTPS server, 600 MB upload limit
│   │   └── certs/             TLS certificate + key (git-ignored, generated by script)
│   ├── traefik/
│   │   └── dynamic.yml        Traefik TLS cert config + backend transport
│   ├── client/
│   │   └── Dockerfile         Node 22 image for Next.js dev server
│   └── php/
│       ├── Dockerfile         PHP 8.4-FPM + GDAL tools
│       └── entrypoint.sh      Starts PHP-FPM
├── generate-certs.sh          Self-signed TLS certificate generator
├── docker-compose.yml
├── Makefile
└── .env
```
