# rich-agent - Implementation Tasks

> Generated from `design.md (v4.1)` with auto-approval (`-y`).
> Focus: Repository Pattern, 1:1 DM Threading, Durable Execution, Conversation Compaction.

## 1. Project Setup & Configuration
*(P) - Can be started immediately*

### 1.1 Install Dependencies & Configure Environment (P)
- **Task**: Install necessary packages and configure Workers environment.
- **Details**:
  - Install `@neondatabase/serverless`, `@langchain/langgraph-checkpoint-postgres`.
  - Add `MEMORY_KV` to `wrangler.jsonc` and `worker-configuration.d.ts`.
  - Ensure `DATABASE_URL` (Neon) is accessible in `process.env` (via `.dev.vars` / secrets).
- **Requirements**: NFR-DEP-1, NFR-DEP-2
- **Files**: `package.json`, `wrangler.jsonc`, `src/types/worker-configuration.d.ts`

### 1.2 Separate Database Schemas (D1 vs Neon) (P)
- **Task**: Create a dedicated schema structure for Neon to avoid conflict with D1 (SQLite).
- **Details**:
  - Create `src/db/neon-schema/` directory.
  - Define `checkpoints.ts` (replicating LangGraph PostgresSaver schema: `checkpoints`, `checkpoint_blobs`, `checkpoint_writes`).
  - Define `rag.ts` (`rag_sources`, `rag_documents`, `rag_chunks`, `rag_embeddings`).
  - Define `vision.ts` (`vision_images`, `vision_summaries`).
  - Define `decisions.ts` (`retrieval_decisions`).
  - Create `drizzle.neon.config.ts` targeting `migrations-neon/`.
  - Add scripts: `db:neon:generate`, `db:neon:migrate`.
- **Requirements**: REQ-MEM-2, REQ-RAG-2, REQ-VIS-2, REQ-TOOL-3, NFR-REL-1
- **Files**: `src/db/neon-schema/*.ts`, `drizzle.neon.config.ts`, `package.json`

## 2. Repository Layer (Infrastructure)
*Implements the Repository Pattern defined in Design 3.3. Dependencies: Task 1.2*

### 2.1 Define Repository Interfaces (P)
- **Task**: Define the contracts for data access, decoupling logic from infrastructure.
- **Details**:
  - `LongTermMemoryRepository`: `get`, `put`, `search` (REQ-MEM-5).
  - `VisionCacheRepository`: `getBySha256`, `upsertBySha256` (REQ-VIS-2).
  - `RagRepository`: `topK` (REQ-RAG-4).
  - `DecisionLogRepository`: `insert` (REQ-TOOL-3).
  - `CheckpointerRepository`: Interface wrapper or direct usage of `PostgresSaver` with pre-configured pool.
- **Files**: `src/agents/telegram/repositories/interfaces.ts`

### 2.2 Implement Neon Repositories (P)
- **Task**: Implement repositories using `drizzle-orm/neon-http` and `@neondatabase/serverless`.
- **Details**:
  - `NeonRagRepository`: Vector search using pgvector (via sql operators).
  - `NeonVisionCacheRepository`: Simple CRUD.
  - `NeonDecisionLogRepository`: Insert logging.
  - `NeonCheckpointerRepository`: Instantiate `PostgresSaver` with `ws` pool (no setup).
- **Files**: `src/agents/telegram/repositories/neon/*.ts`

### 2.3 Implement KV Store Repository (P)
- **Task**: Implement `LongTermMemoryRepository` using Cloudflare KV.
- **Details**:
  - Implement `put/get` using Key: `users:{userId}:{key}`.
  - Implement `search` using `list({ prefix })` + metadata filtering.
- **Requirements**: REQ-MEM-3, REQ-MEM-5
- **Files**: `src/agents/telegram/repositories/kv.ts`

### 2.4 Implement D1 Repository (P)
- **Task**: Implement `D1ConversationLogRepository` for existing/audit logs.
- **Details**:
  - Wrapper around existing D1 queries for message logging.
- **Files**: `src/agents/telegram/repositories/d1.ts`

### 2.5 Dependency Injection Wiring
- **Task**: Create the `createRepositories` factory.
- **Details**:
  - Input: `Env` (Cloudflare bindings).
  - Output: Object containing all initialized repositories.
- **Files**: `src/agents/telegram/repositories/index.ts`

## 3. Agent Logic (Nodes & State)
*Dependencies: Task 2.5*

### 3.1 Define Agent State & Types (P)
- **Task**: Define `StateGraph` schema and shared types.
- **Details**:
  - State: `messages`, `user`, `input`, `vision`, `rag`, `memory`, `routing`, `answer`.
  - Include `conversation_summary` in `memory` for compaction (Design 9.1.1).
  - Zod schemas for Vision output.
- **Requirements**: REQ 6.1, REQ-VIS-1
- **Files**: `src/agents/telegram/graph-state.ts`, `src/agents/telegram/schemas.ts`

### 3.2 Implement Core Nodes (Part 1: Input/Vision) (P)
- **Task**: Implement ingestion and vision processing nodes.
- **Details**:
  - `N1_ingest_input`: Normalize input, set `thread_id` (REQ-TG-1).
  - `N2_load_long_term_memory`: Fetch from Repo.
  - `N3_vision_summarize`: Check Repo cache -> LLM (Structured Output) -> Save cache (REQ-VIS-1, 2).
- **Files**: `src/agents/telegram/nodes/ingest.ts`, `src/agents/telegram/nodes/vision.ts`, `src/agents/telegram/nodes/memory.ts`

### 3.3 Implement Core Nodes (Part 2: RAG/Routing) (P)
- **Task**: Implement retrieval and planning nodes.
- **Details**:
  - `N4_build_effective_query`: Contextualize query, decide plan (Agentic RAG) (REQ-RAG-6, REQ-ROUTE-1).
  - `N5_retrieve`: Call `RagRepository.topK` (REQ-RAG-4).
  - `N8_web_search`: Call Tavily (REQ-TOOL-1).
- **Files**: `src/agents/telegram/nodes/rag.ts`, `src/agents/telegram/nodes/routing.ts`

### 3.4 Implement Core Nodes (Part 3: Synthesis/Persist) (P)
- **Task**: Implement answer generation and persistence.
- **Details**:
  - `N6_synthesize`: Generate answer with citations (REQ-RAG-4).
  - `N7_persist`: Save logs, update Long-term memory (REQ-MEM-4).
  - **Conversation Compaction**: Implement windowing/summary update logic here or in a specialized node (Design 9.1.1).
- **Files**: `src/agents/telegram/nodes/synthesize.ts`, `src/agents/telegram/nodes/persist.ts`

## 4. Graph Orchestration
*Dependencies: Task 3.x*

### 4.1 Construct StateGraph
- **Task**: Wire nodes and edges, compiling the graph.
- **Details**:
  - Define Conditional Edges for routing (Direct/RAG/Web) (REQ 6.3).
  - Register Checkpointer (PostgresSaver) (REQ-MEM-1).
  - Define `interrupt` logic if needed (REQ-INT-1).
- **Files**: `src/agents/telegram/index.ts`

## 5. Integration & Ingestion
*Dependencies: Task 4.1*

### 5.1 Update Telegram Handler
- **Task**: Integrate the new Graph into the Hono handler.
- **Details**:
  - Enforce `thread_id = tg:{userId}` (REQ-TG-1).
  - Handle image inputs (download -> sha256) (REQ-TG-2).
  - Implement streaming response (typing, partial tokens) (REQ-TG-4).
- **Files**: `src/bot/handler.ts`

### 5.2 RAG Ingestion CLI (P)
- **Task**: Create a script to ingest documents into Neon.
- **Details**:
  - Read URLs/files (REQ-RAG-1).
  - Compute `content_hash` for diffing (REQ-RAG-5).
  - Chunk & Embed -> `RagRepository` (or direct DB insert for script).
- **Requirements**: REQ-RAG-1, 2, 3, 5
- **Files**: `scripts/ingest-docs.ts`

## 6. Verification & Migration
*Dependencies: Task 5.x*

### 6.1 Unit Tests (P)
- **Task**: Test Repositories and critical Nodes.
- **Details**:
  - Mock `Env` for Repository tests.
  - Test Routing logic and State transitions.
- **Files**: `tests/unit/agents/telegram/*`

### 6.2 Manual Migration & Verify
- **Task**: Run migrations and verify end-to-end.
- **Details**:
  - Run `bun run db:migrate`.
  - Test bot with text, image, and RAG questions.
- **Acceptance**: All AC-1..9 satisfied.
