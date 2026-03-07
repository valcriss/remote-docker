# remote-docker

Monorepo MVP containing:
- `apps/remote-docker-agent` (C# Windows agent)
- `apps/backend` (TypeScript + Express + Prisma + WebSocket)
- `apps/frontend` (Vue 3 + Vite)
- `packages/shared` (shared TypeScript contracts)

## Build

```bash
npm install
npm run build
dotnet build apps/remote-docker-agent
```

## Dev dependencies (DB)

Start local dependencies with Docker:

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Adminer on `http://localhost:8081`

## Run backend

```bash
cd apps/backend
copy .env.example .env
npx prisma migrate dev --name init
npm run dev
```

## API clarity model

- Persona routes:
  - `GET /api/me/dashboard`
  - `GET /api/admin/dashboard`
  - `GET /api/admin/sessions`
- Normalized response envelope:
  - success: `{ data, meta, error: null }`
  - failure: `{ data: null, error: { code, message, details, requestId } }`
- API docs:
  - Swagger UI: `http://localhost:4000/docs`
  - OpenAPI JSON: `http://localhost:4000/openapi.json`

## Run frontend

```bash
cd apps/frontend
npm run dev
```

## Run agent

1. Edit `apps/remote-docker-agent/appsettings.json` and set `JwtToken`.
2. Start:

```bash
dotnet run --project apps/remote-docker-agent
```

## MVP features implemented

- Docker/Swarm orchestrator adapter in backend (`ORCHESTRATOR_MODE=standalone|swarm`) with `CONTAINER` and `COMPOSE` templates.
- Admin catalog template creation.
- Admin catalog declarations support explicit `serviceName` mapping for each port/volume.
- User instance creation/stop/restart.
- Agent WebSocket control plane.
- API-driven local port forwards (`/api/forwards`).
- Bidirectional SFTP sync commands (`/api/sync/start`, `/api/sync/stop`) with conflict policy (`prefer-local`, `prefer-remote`, `manual`).
- `COMPOSE` behavior:
  - standalone mode: `docker compose -p <project> up -d` then containers managed via Docker API.
  - swarm mode: `docker stack deploy -c <file> <stack>` then services managed via Docker API.
