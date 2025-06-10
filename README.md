# Hono LangGraph Telegram Bot

A Telegram bot built with Hono, LangGraph, and Drizzle ORM using Neon PostgreSQL database.

## Features

- 🤖 Telegram bot with webhook support
- 🗄️ PostgreSQL database with Drizzle ORM
- 🧠 LangGraph integration for AI workflows
- 🔗 Solana wallet integration
- 📊 User profile management and chat history

## Setup

### 1. Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@hostname:port/database

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# OpenAI Configuration (for LangGraph)
OPENAI_API_KEY=your_openai_api_key_here

# Helius SDK Configuration (for Solana assets)
HELIUS_API_KEY=your_helius_api_key_here

# Development Environment
NODE_ENV=development
```

### 2. Database Setup

1. Create a Neon PostgreSQL database
2. Generate and run migrations:

```bash
bun install
bun run db:generate
bun run db:push
```

### 3. Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get your bot token and add it to `.env`
3. Set the webhook URL (after deployment):

```bash
curl -X POST https://your-domain.com/webhook/set \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook/telegram"}'
```

## Development

```bash
bun install
bun run dev
```

## Database Commands

```bash
# Generate migration files
bun run db:generate

# Push schema to database
bun run db:push

# Run migrations
bun run db:migrate

# Open Drizzle Studio
bun run db:studio
```

## Deployment

```bash
bun run deploy
```

## API Endpoints

- `GET /` - Health check
- `GET /health` - Health status
- `POST /webhook/telegram` - Telegram webhook
- `POST /webhook/set` - Set webhook URL
- `GET /webhook/info` - Get webhook info

## Database Schema

### Users Table

- `userId` (Primary Key) - Telegram user ID
- `walletAddress` - Solana wallet address
- `age` - User age
- `cryptoRiskTolerance` - Risk tolerance (1-10)
- `totalAssets` - Total assets value
- `cryptoAssets` - Crypto assets value
- `panicLevel` - Panic level (1-10)
- `heartRate` - Heart rate from wearables
- `interests` - JSON array of interests
- `currentSetupStep` - Current setup step
- `setupCompleted` - Setup completion status
- `waitingForInput` - Input waiting state
- `lastUpdated` - Last update timestamp
- `createdAt` - Creation timestamp

### Chat History Table

- `messageId` (Primary Key) - Message ID
- `userId` (Foreign Key) - Reference to users table
- `content` - Message content
- `messageType` - Message type ('human' or 'ai')
- `timestamp` - Message timestamp

Chat history is now persisted in the Neon database, allowing conversations to continue across bot restarts. Users can clear their chat history using the `/clear` command.

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
bun run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
