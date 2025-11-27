# AGENTS.md

## Commands
- **Build**: `pnpm build` | **Lint**: `pnpm lint` | **Typecheck**: `pnpm typecheck`
- **Test single file**: `pnpm test path/to/file.test.ts` | **Test all**: `pnpm test:run`
- **Integration tests**: `pnpm test:integration:server` (start) → `pnpm test:integration:dev` (run)
- **Python tests**: `cd emery-agents && uv run pytest tests/`
- **Database**: `pnpm db:generate` | `pnpm db:migrate` | `pnpm db:studio`
- **gRPC**: `pnpm grpc:generate` after .proto changes

## Code Style
- **TypeScript**: Strict mode, use `@/*` imports, DDD patterns (entities in domain/, services in application/)
- **Python**: Black formatting (88 chars), isort imports, mypy strict, simple DDD (domain/application/infrastructure)
- **Error handling**: Use Result/Either patterns, avoid try/catch for flow control
- **Naming**: PascalCase for types/components, camelCase for variables/funcs, snake_case for Python
- **Testing**: Interface-based test cases, use vitest globals, pytest markers for integration/slow tests