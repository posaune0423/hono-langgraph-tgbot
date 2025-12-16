# Structure Steering

## Directory Organization

### Core Pattern: Feature-First with Domain Separation

```
src/
├── agents/          # AI agent implementations
├── bot/             # Telegram bot setup and handlers
├── routes/          # Hono API routes
├── db/              # Database schema and utilities
├── utils/           # Shared utility functions
├── constants/       # Application constants
├── types/           # TypeScript type definitions
├── api.ts           # Hono app entry point
├── worker.ts        # Cloudflare Worker entry
└── cron.ts          # Scheduled task definitions
```

## Naming Conventions

### Files and Folders
- **Folders**: lowercase, kebab-case for multi-word (`graph-state.ts`)
- **Files**: lowercase, descriptive names matching their primary export
- **Constants folder**: Group related constants by responsibility (`src/constants/`)

### Code Elements
- **Functions**: camelCase, verb-based (`getUser`, `setupHandler`, `initAgent`)
- **Types/Interfaces**: PascalCase (`User`, `NewUser`, `UpdateUser`)
- **Constants**: UPPER_SNAKE_CASE (`TIMEOUT_MS`, `ADMIN_API_KEY_HEADER`)
- **Classes**: PascalCase (rarely used; prefer functions)

### Domain-Specific Patterns
- **Bot commands**: `/start`, `/help`, `/stats`, `/ping` (lowercase)
- **Routes**: `/webhook/telegram`, `/health` (kebab-case)
- **Database tables**: plural nouns (`users`, `messages`)

## Import Patterns

### Import Order
1. External dependencies (Hono, LangGraph, etc.)
2. Internal modules (relative imports)
3. Types (can be inline or separate)

### Import Style
- Use named exports (`export const`, `export function`)
- Prefer explicit imports over `import *`
- Group related imports together

### Example Structure
```typescript
// External
import { Hono } from "hono";
import { StateGraph, END, START } from "@langchain/langgraph";

// Internal - domain modules
import { getDB } from "../db";
import { logger } from "../utils/logger";

// Internal - types (if needed separately)
import type { User } from "../db/schema";
```

## Module Organization Patterns

### Agents (`src/agents/`)
- **model.ts**: Centralized LLM model configurations
- **telegram/**: Telegram-specific agent implementation
  - `index.ts`: Agent initialization (`initAgent`)
  - `graph-state.ts`: State annotations and memory
  - `nodes/`: Processing nodes (one per file)
  - `prompts/`: Prompt templates

### Bot (`src/bot/`)
- **index.ts**: Bot singleton and initialization
- **handler.ts**: Message handler setup (`setupHandler`)
- **commands.ts**: Command registration (`setupCommands`)

### Routes (`src/routes/`)
- One route file per domain/feature
- Export default Hono route instance
- Import and mount in `src/api.ts`

### Database (`src/db/`)
- **schema/**: Table definitions (one file per table)
- **index.ts**: Schema exports and DB connection
- **utils.ts**: Database helper functions (`getUser`, `upsertUser`)

### Utils (`src/utils/`)
- Pure utility functions
- Domain-agnostic helpers
- Logger, telegram helpers, etc.

## Code Organization Principles

### Separation of Concerns
- **Pure functions** in `lib/pure` (when needed) or `utils/`
- **Domain logic** in domain-specific folders (`agents/`, `bot/`)
- **Infrastructure** in `db/`, `routes/`, `utils/`

### Single Responsibility
- One file = one primary responsibility
- Nodes in separate files (`nodes/general.ts`)
- Prompts in separate files (`prompts/general.ts`)
- Schema tables in separate files (`schema/user.ts`)

### Dependency Direction
- Utils → Domain modules (utils are shared)
- Routes → Bot/Agents (routes orchestrate)
- Agents → DB (agents use database)
- Avoid circular dependencies

## Constants Organization

- **Location**: `src/constants/index.ts`
- **Grouping**: By responsibility (timeouts, headers, origins)
- **Naming**: Descriptive, UPPER_SNAKE_CASE
- **Pattern**: Export individual constants, not objects

## Type Definitions

- **Location**: `src/types/`
- **Worker types**: `worker-configuration.d.ts` (generated)
- **Application types**: `index.ts` (custom types)
- **Schema types**: Inferred from Drizzle schemas (`$inferSelect`, `$inferInsert`)

## Testing Structure

```
tests/
├── unit/           # Unit tests (mocked dependencies)
│   ├── agents/
│   ├── lib/
│   └── routes/
└── integration/    # Integration tests (real dependencies)
```

- Mirror `src/` structure in `tests/unit/`
- Test files: `*.test.ts`
- Mock external dependencies
- Use dependency injection for testability

## Comments and Documentation

- **Source code comments**: English only
- **JSDoc**: For public APIs when helpful
- **README**: Project-level documentation
- **Architecture docs**: In `docs/` folder

## Extension Patterns

### Adding a New Route
1. Create file in `src/routes/`
2. Export default Hono route
3. Import and mount in `src/api.ts`

### Adding a New Agent Node
1. Create file in `src/agents/telegram/nodes/`
2. Export node function with state signature
3. Add to graph in `src/agents/telegram/index.ts`

### Adding a New Database Table
1. Create schema file in `src/db/schema/`
2. Export table and types
3. Add to `src/db/schema/index.ts`
4. Generate migration: `bun run db:generate`
