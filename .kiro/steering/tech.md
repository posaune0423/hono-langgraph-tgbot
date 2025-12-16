# Technology Steering

## Core Stack

### Runtime & Deployment
- **Cloudflare Workers**: Serverless edge runtime
- **Bun**: Package manager and runtime (primary development environment)

### Web Framework
- **Hono**: Ultra-fast, lightweight web framework optimized for edge computing
  - CORS middleware for cross-origin requests
  - Route-based organization (`src/routes/`)
  - Error handling and not-found handlers

### Bot Framework
- **grammY**: TypeScript-first Telegram Bot API framework
  - Webhook-based message handling
  - Command system integration
  - Context-based message processing

### AI Framework
- **LangGraph**: Stateful, multi-actor AI agent workflows
  - StateGraph for workflow definition
  - MemorySaver for conversation persistence
  - Node-based processing architecture

### LLM Providers
- **OpenAI**: GPT-4o, GPT-4o-mini
- **Groq**: Llama 3.1 70B, Mixtral 8x7B, GPT-Oss 120B
- Centralized model configuration in `src/agents/model.ts`

### Database
- **Cloudflare D1**: Serverless SQLite database
- **Drizzle ORM**: Type-safe database operations
  - Schema definitions in `src/db/schema/`
  - Migration-based schema management
  - Type inference from schema

### Language & Tooling
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess`
- **tsup**: Build tool for ESM output
- **Prettier**: Code formatting with organize-imports plugin
- **ESLint**: Linting with TypeScript support

## Key Conventions

### Error Handling
- Use `neverthrow` Result type for error handling
- Structured error types (ValidationError, ConversationError, etc.)
- Graceful fallbacks for missing data

### Logging
- Custom logger (`src/utils/logger.ts`) instead of console
- Configurable log levels via `LOG_LEVEL` environment variable
- Colorized output for development
- Structured log entries with timestamps

### Type Safety Patterns
- Dependency injection for external services (testability)
- Parameter-based overrides for global state (env vars)
- Type inference from Drizzle schemas
- Avoid `as any`; use `@ts-expect-error` with comments when needed

### Testing
- Vitest for test framework
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Mock injection points for external dependencies

## Configuration

### Environment Variables
- `.dev.vars` for local development
- Cloudflare Workers secrets for production
- Never commit secrets; use `.dev.vars.example` as template

### TypeScript Configuration
- Strict mode enabled
- ESNext target and module resolution
- Bundler module resolution for Cloudflare Workers
- Custom types via `src/types/worker-configuration.d.ts`

### Cloudflare Workers
- Cron triggers: `*/5 * * * *` (every 5 minutes)
- D1 database binding: `DB`
- Observability enabled with head sampling

## Development Workflow

1. **Schema Changes**: Modify schema → `bun run db:generate` → apply migrations
2. **Type Checking**: `bun run typecheck` before commits
3. **Testing**: `bun run test` (unit + integration)
4. **Formatting**: `bun run format:fix` for auto-formatting
5. **Deployment**: `bun run deploy` → apply remote migrations

## Dependency Management

- Use Bun for package management (`bun install`, `bun update`)
- Check type compatibility after updates
- Run full test suite after dependency changes
- Update test mocks if type definitions change
