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
  └── Messenger worker (background, same container)
        │  shell
        ▼
GDAL tools (ogr2ogr · ogrinfo)
        │  files
        ▼
Storage
  ├── var/private/layers/   — raw uploads (private)
  └── public/geojson/       — converted outputs (public)
```

The Messenger worker starts automatically inside the PHP container via `entrypoint.sh`. It runs with `--time-limit=3600` and is restarted by a shell loop, so no separate worker container or process manager is needed.

## Entities

```
Project ──< Layer
   └──< LayerGroup ──< Layer
```

- **Project** — top-level container; holds layers and groups.
- **Layer** — a geo dataset with an optional uploaded file, conversion status, GeoJSON output path, and extracted metadata.
- **LayerGroup** — organises related layers within a project (created automatically when a multi-layer conversion is confirmed).
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
JWT_PASSPHRASE=your_passphrase
NEXT_PUBLIC_ENTRYPOINT=https://api.localhost
```

### 2. Add api.localhost to /etc/hosts

```bash
echo "127.0.0.1  api.localhost" | sudo tee -a /etc/hosts
```

On Windows, add `127.0.0.1  api.localhost` to `C:\Windows\System32\drivers\etc\hosts` as Administrator.

### 3. Generate TLS certificates

```bash
./generate-certs.sh
```

This creates a self-signed certificate in `docker/nginx/certs/` covering `localhost` and `api.localhost`. To avoid browser warnings, follow the trust instructions printed by the script.

### 4. Generate JWT keys

```bash
mkdir -p config/jwt
openssl genrsa -out config/jwt/private.pem -aes256 4096   # use JWT_PASSPHRASE when prompted
openssl rsa -pubout -in config/jwt/private.pem -out config/jwt/public.pem
```

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
docker logs app_php -f

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
GET    /api/layer_groups             List groups (filter: ?project=IRI)
POST   /api/layer_groups             Create group
```

## File structure

```
.
├── config/                    Symfony configuration
├── docker/
│   ├── nginx/
│   │   ├── default.conf       HTTPS server, 600 MB upload limit
│   │   └── certs/             TLS certificate + key (git-ignored, generated by script)
│   ├── traefik/
│   │   └── dynamic.yml        Traefik TLS cert config + backend transport
│   └── php/
│       ├── Dockerfile         PHP 8.4-FPM + GDAL tools
│       └── entrypoint.sh      Starts Messenger worker + PHP-FPM
├── migrations/                Doctrine database migrations
├── src/
│   ├── Controller/            Custom API endpoints (convert, detect, file serve)
│   ├── Entity/                Project · Layer · LayerGroup · User
│   ├── GeoConverter/          GeoConverterService (ogr2ogr / ogrinfo wrapper)
│   ├── Message/               ConvertLayerFileMessage
│   ├── MessageHandler/        ConvertLayerFileMessageHandler
│   ├── Repository/            Doctrine repositories
│   └── State/                 API Platform state processors
├── client/
│   ├── components/            React components (forms, lists, map)
│   ├── pages/                 Next.js pages
│   ├── styles/                Global CSS
│   ├── types/                 TypeScript types
│   └── utils/                 API fetch helper, Mercure, data access
├── public/geojson/            Converted GeoJSON output (git-ignored)
├── var/private/layers/        Raw uploaded files (git-ignored)
├── generate-certs.sh          Self-signed TLS certificate generator
├── docker-compose.yml
├── Makefile
└── .env
```
