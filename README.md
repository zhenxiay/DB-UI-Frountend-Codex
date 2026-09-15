# AG-UI Frontend

The AG-UI Frontend is a TypeScript Next.js App Router application. This baseline contains only the application shell and developer tooling; authentication, agent connectivity, persistence, and product UI are added in later tasks.

## Prerequisites

- Node.js 20.9 or later (Node.js 24 is the currently verified local version)
- npm 10 or later

## Local development

Install the locked dependency set, then start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run format:check
npm run test
npm run test:e2e
npm run build
```

Run `npm run format` to apply repository formatting.

`npm run test` executes the Vitest unit/component suite with React Testing Library
and local jsdom fixtures. `npm run test:e2e` starts the Next.js development server
on `127.0.0.1` and runs the Playwright homepage smoke test in Chromium. Install
the browser once on a new machine with `npx playwright install chromium`.

For local development, use `npm run dev`; production output is verified with
`npm run build`.

## Container deployment

Build the production image from a clean checkout:

```bash
docker build -t ag-ui-frontend .
```

The container runs the standalone Next.js server on port `3000` by default.
Mount persistent application data at `/data`, and configure SQLite to use a
path within that volume:

```bash
docker run --rm -p 3000:3000 \
  -v ag-ui-data:/data \
  -e SQLITE_PATH=/data/ag-ui.sqlite \
  ag-ui-frontend
```

Set `PORT` and update the host-port mapping together when a different
listening port is needed. `HOSTNAME` defaults to `0.0.0.0` so the server is
reachable from outside the container.

`GET /api/health` is an unauthenticated liveness endpoint. It returns
`{ "status": "ok" }` with HTTP 200 when the Next.js server is responsive; it
does not validate SQLite, migrations, or external dependencies. Docker uses
this endpoint for its image health check. Database-aware readiness validation
is added with the SQLite setup work.

### Non-secret configuration

The deployment environment supplies the following non-secret configuration
names. Values for identity, administration, and Agno integration take effect
as their respective application features are implemented.

| Name                         | Purpose                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| `PORT`                       | HTTP listening port; defaults to `3000`.                      |
| `HOSTNAME`                   | HTTP bind address; defaults to `0.0.0.0`.                     |
| `SQLITE_PATH`                | SQLite database path under the `/data` mounted volume.        |
| `APP_ORIGIN`                 | Public origin of this application.                            |
| `ENTRA_TENANT_ID`            | Microsoft Entra tenant identifier.                            |
| `ENTRA_CLIENT_ID`            | Microsoft Entra application client identifier.                |
| `BOOTSTRAP_ADMIN_OBJECT_IDS` | Comma-separated Entra object IDs for administrator bootstrap. |
| `AGNO_ADAPTER_API_VERSION`   | Pinned Agno adapter API version.                              |

Provide all secret values through the deployment platform's secret mechanism.
Do not add secret values to Dockerfiles, image layers, source files, or command
examples.
