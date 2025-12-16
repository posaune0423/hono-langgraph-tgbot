# 🤖 Agents Architecture Documentation

This document describes the architecture and organization of the AI agents system in the Hono + LangGraph Telegram Bot project.

## 🏗️ Technology Stack

- **Runtime**: Cloudflare Workers (Serverless)
- **Web Framework**: Hono (Fast, lightweight)
- **Bot Framework**: grammY (Telegram Bot API)
- **AI Framework**: LangGraph (Conversation workflows)
- **LLM Providers**: OpenAI GPT-4o, Groq
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Language**: TypeScript
- **Package Manager**: Bun

## 📁 Directory Structure

```text
src/
├── agents/
│   ├── model.ts                     # LLM model configurations
│   └── telegram/                    # Telegram-specific agent implementation
│       ├── index.ts                 # initAgent: builds and compiles the graph
│       ├── graph-state.ts           # State annotations and MemorySaver
│       ├── nodes/
│       │   ├── general.ts           # General conversation node (LLM call)
│       │   └── data-fetch.ts        # User data loader
│       └── prompts/
│           └── general.ts           # General conversation prompt (template)
├── bot/
│   ├── index.ts                     # Bot singleton and initialization
│   └── handler.ts                   # Telegram message handler (grammY)
├── routes/
│   └── webhook.ts                   # Webhook endpoint for Telegram
├── db/
│   ├── index.ts                     # Drizzle + D1 connector and schema export
│   └── utils.ts                     # DB convenience helpers (e.g., getUser)
├── api.ts                           # Hono app entry (routes, CORS, DB bind)
└── utils/
    ├── logger.ts                    # Colorized logger (use instead of console)
    └── telegram.ts                  # Telegram helpers (e.g., extractUserInfo)
```

## 🏗️ Architecture Overview

### Core Components

#### 1. Model Configuration (`model.ts`)

- **Purpose**: Centralized LLM model configurations
- **Responsibilities**:
  - Define OpenAI and Groq model instances
  - Manage API keys and model parameters
  - Provide consistent model access across agents

```typescript
import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";

export const gpt4o = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

export const gpt4oMini = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  timeout: 8000,
  apiKey: process.env.OPENAI_API_KEY,
});

export const kimiK2 = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "moonshotai/kimi-k2-instruct",
  timeout: 15000,
});

export const llama3370bVersatile = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  timeout: 15000,
});

export const gptOss120b = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  timeout: 15000,
});
```

#### 2. Telegram Agent (`agents/telegram`)

Main agent implementation for Telegram bot functionality using LangGraph.

### 🔄 LangGraph Implementation

#### Graph Construction (`agents/telegram/index.ts`)

- **Purpose**: Define and compile the conversation workflow
- **Responsibilities**:
  - Initialize `StateGraph` with nodes
  - Define edges between nodes
  - Compile with `MemorySaver` checkpointer

```typescript
import { END, START, StateGraph } from "@langchain/langgraph";
import { graphState, memory } from "./graph-state";
import { dataFetchNode } from "./nodes/data-fetch";
import { generalistNode } from "./nodes/general";

export async function initAgent(userId: number) {
  const workflow = new StateGraph(graphState)
    .addNode("dataFetch", dataFetchNode)
    .addNode("generalist", generalistNode)
    .addEdge(START, "dataFetch")
    .addEdge("dataFetch", "generalist")
    .addEdge("generalist", END);

  const graph = workflow.compile({ checkpointer: memory });
  const config = { configurable: { thread_id: userId } };
  return { graph, config };
}
```

#### State Management (`agents/telegram/graph-state.ts`)

- **Purpose**: Define conversation state structure and memory
- **State**:
  - `messages`: Conversation transcript
  - `user`: User record fetched from D1

```typescript
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, MemorySaver, messagesStateReducer } from "@langchain/langgraph";
import type { User } from "../../db";

export const memory = new MemorySaver();

export const graphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  user: Annotation<User | null>({
    reducer: (oldValue, newValue) => newValue ?? oldValue,
    default: () => null,
  }),
});
```

### 🎯 Processing Nodes

#### General Node (`nodes/general.ts`)

- **Purpose**: Handle general conversation and queries
- **Current behavior**: Directly invokes the selected LLM with accumulated `messages` and appends the AI result. Includes a safe fallback message on error.

```typescript
import { AIMessage } from "@langchain/core/messages";
import { gpt4oMini } from "../../model";
import type { graphState } from "../graph-state";

export const generalistNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  const { messages } = state;
  try {
    const result = await gpt4oMini.invoke(messages);
    return { messages: [...messages, result] };
  } catch {
    const fallback = new AIMessage(
      "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment! 🤖",
    );
    return { messages: [...messages, fallback] };
  }
};
```

#### Data Fetch Node (`nodes/data-fetch.ts`)

- **Purpose**: Retrieve user record for context enrichment
- **Behavior**: Loads the user by `userId` from D1 (via Drizzle) and merges into state.

```typescript
import { getUser } from "../../../db/utils";
import type { graphState } from "../graph-state";

export const dataFetchNode = async (
  state: typeof graphState.State,
  config?: { configurable?: { thread_id?: number } },
): Promise<Partial<typeof graphState.State>> => {
  const userId = state.user?.userId || config?.configurable?.thread_id;
  if (!userId) return state;
  const user = await getUser(userId);
  if (!user) return state;
  return { ...state, user };
};
```

### 💬 Prompt Management

#### General Prompts (`prompts/general.ts`)

- **Purpose**: Define conversation style and Telegram Markdown formatting rules
- **Note**: The current `generalistNode` calls the LLM directly; prompts can be integrated in a future enhancement.

## 🔧 Integration Points

### Database Integration (`src/db/index.ts`)

```typescript
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let db: DrizzleD1Database<typeof schema>;
export function getDB(d1Binding?: D1Database) {
  if (!db) db = drizzle(d1Binding || (process.env.DB as unknown as D1Database), { schema });
  return db;
}
```

### Bot + Webhook Integration

#### Webhook Route (`src/routes/webhook.ts`)

```typescript
route.post("/telegram", async c => {
  const bot = await initBot();
  const handleUpdate = webhookCallback(bot, "hono", { timeoutMilliseconds: TIMEOUT_MS });
  return await handleUpdate(c);
});
```

#### Bot Initialization (`src/bot/index.ts`)

```typescript
let botInstance: Bot | null = null;
export const getBotInstance = () => {
  if (!botInstance) botInstance = new Bot(process.env.TELEGRAM_BOT_TOKEN as string);
  return botInstance;
};

export const initBot = async () => {
  const bot = getBotInstance();
  await bot.init();
  setupHandler(bot);
  setupCommands(bot);
  return bot;
};
```

#### Message Handler (`src/bot/handler.ts`)

```typescript
bot.on("message", async ctx => {
  const userMessage = ctx.message?.text;
  if (!userMessage) return;
  const { userId } = extractUserInfo(ctx);
  const { graph } = await initAgent(userId);
  const result = await graph.invoke({ messages: [new HumanMessage(userMessage)] });
  const response = result.messages.at(-1)?.content?.toString();
  if (response) await ctx.reply(response);
});
```

## 📊 Data Flow

```mermaid
graph TD
    A[Telegram Webhook] --> B[grammY bot]
    B --> C[Message Handler]
    C --> D[initAgent (StateGraph)]
    D --> E[Data Fetch Node]
    E --> F[General Node]
    F --> G[AI Response]
    G --> H[Reply to User]

    E --> I[Load User from D1]
    F --> J[LLM Processing]
```

### Data Flow Details

1. **Webhook**: Telegram sends updates to `/webhook/telegram`
2. **grammY**: Webhook is handled by grammY via Hono adapter
3. **Handler**: Extracts user info and initializes agent
4. **Graph**: Executes `dataFetch` then `generalist`
5. **Response**: AI message appended and sent back to the user

## 🛡️ Error Handling

### Error Types

- **VALIDATION_ERROR**: Invalid input parameters
- **NO_CONTENT_ERROR**: Empty or invalid responses
- **CONVERSATION_ERROR**: LLM or processing failures

### Recovery Strategies

- Graceful fallbacks for missing data
- User-friendly error messages
- Logging for debugging
- Reasonable timeouts in model calls and webhooks

## 🔮 Extension Points

### Adding New Nodes

1. Create node in `agents/telegram/nodes/`
2. Implement the node with `state: typeof graphState.State`
3. Register it in `initAgent` and wire edges

### Adding New Tools

1. Configure tool usage inside the relevant node
2. Add API key management
3. Update prompts if necessary
4. Test integration

### Adding New Agent Types

1. Create a new directory under `agents/`
2. Follow the `telegram/` structure pattern
3. Implement required interfaces and state

## 🧪 Testing Strategy

- **Unit Tests**: Node-level behavior (e.g., `generalist`, `dataFetch`)
- **Integration Tests**: Graph execution and webhook handling
- **Error Scenario Tests**: Fallbacks and timeouts

## 📈 Performance Considerations

- **Graph Caching**: Compiled graphs per user thread
- **Memory Management**: `MemorySaver` for conversation state
- **Timeouts**: Shorter LLM timeout for responsiveness

## 🔒 Security

- **API Key Management**: Environment variables for OpenAI/Groq
- **Input Validation**: Sanitize and validate inbound updates
- **Rate Limiting**: Managed at bot level and Cloudflare edge
- **User Data**: Access via D1 using Drizzle

## 🗄️ Data Layer Integration

### Database Architecture

Integrates with **Cloudflare D1** (SQLite) for persistent data storage.

#### Data Access Helpers

```typescript
// src/db/utils.ts
export const getUser = async (userId: number) => {
  const db = getDB();
  const [user] = await db.select().from(users).where(eq(users.userId, userId));
  return user;
};
```

#### State Persistence

- **LangGraph State**: In-memory during a run; checkpointed by `MemorySaver`
- **User Records**: Retrieved from D1; extend to persist messages if needed

### Database Performance Considerations

- **Global Distribution**: D1 provides low-latency access worldwide
- **Auto-scaling**: Serverless architecture scales with demand
- **Query Optimization**: Drizzle ORM with typed queries

## 🛡️ Data Security & Privacy

### Security Measures

- **Encrypted at Rest**: D1 provides encryption by default
- **Access Control**: Worker-level database binding
- **SQL Injection Prevention**: Drizzle ORM parameterized queries

### Privacy Considerations

- **Data Minimization**: Only store necessary user data
- **Retention Policy**: Consider message history limits if persisted later

## 📈 Performance Monitoring

### Key Metrics

- **Response Latency**: Webhook handling and LLM invocation
- **Memory Usage**: LangGraph state management
- **Error Rates**: LLM failures and webhook timeouts

---

This architecture reflects the current implementation and provides a clean foundation for extending prompts, tools, and additional nodes.
