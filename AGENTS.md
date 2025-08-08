# Repository Guidelines

This guide helps contributors work effectively in this repo.

## Project Structure & Module Organization

- `app/`: Next.js (App Router) UI and API routes (`app/api/*`).
- `lib/`: Database (`lib/db/*`), gRPC client, auth, and agent utilities.
- `emery-agents/`: Python gRPC worker package (`src/emery_agents/*`).
- `proto/`: Protocol Buffers (`agent_worker.proto`).
- `scripts/`: Dev and integration test scripts (TS/Node).
- `drizzle/`, `drizzle.config.ts`: Migrations and schema config.
- `database/`, `backend/`, `components/`, `types/`, `utils/`: Supporting modules.

## Build, Test, and Development Commands

- `pnpm dev`: Run Next.js dev server at `http://localhost:3000`.
- `pnpm build` / `pnpm start`: Build and serve production bundle.
- `pnpm lint`: Lint TypeScript/JS with Next.js ESLint config.
- `docker-compose up -d`: Start PostgreSQL (pgvector) for local dev.
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio`: Drizzle migrations and studio.
- `pnpm worker:start`: Start Python gRPC worker (via `uv`).
- `pnpm grpc:generate`: Generate protobuf code for TS and Python.
- `pnpm test:grpc` / `pnpm test:nextjs-grpc`: gRPC and Next.js integration tests.

## Coding Style & Naming Conventions

- TypeScript (Node/Next.js) and Python workers.
- Indentation: 2 spaces (TS), 4 spaces (Python).
- Filenames: kebab-case for TS/React components, snake_case for Python modules.
- API routes live under `app/api/<namespace>/<route>/route.ts`.
- Use ESLint (Next.js config). Keep imports ordered; prefer explicit types for public APIs.

## Testing Guidelines

- Integration-first: run `pnpm test:nextjs-grpc` or `pnpm test:grpc` to validate API↔worker flows.
- Auth testing: see `TESTING.md`; prefer API key flow via `npx tsx scripts/setup-user-auth.ts`.
- Python worker: run with `pnpm worker:start`; add focused tests under `emery-agents/src/...`.
- Name TS test scripts descriptively in `scripts/` (e.g., `test-scheduler-system.ts`). Python tests use `test_*.py`.

## Commit & Pull Request Guidelines

- Commits: short, imperative mood (e.g., "Fix db connection leak", "Implement task model"). Avoid `wip`.
- Scope prefix optional; keep subject ≤ 72 chars; include a concise body when needed.
- PRs: include purpose, screenshots for UI, steps to reproduce/verify, and linked issues.
- Checklist: passes `pnpm lint`, migrations generated/applied (if schema changes), tests/scripts updated.

## Security & Configuration

- Copy env: `cp .env.example .env.local`; never commit secrets.
- Required vars: NextAuth, Pipedream, database, and worker addresses (see README.md).
- Use Docker Postgres during development; reset with `docker volume rm emery_db` if needed.

