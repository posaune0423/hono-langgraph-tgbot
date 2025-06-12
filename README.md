# Hono LangGraph Telegram Bot

A Telegram bot built with Hono, LangGraph, and Drizzle ORM using Neon PostgreSQL database.

## Features

- 🤖 Telegram bot with webhook support
- 🗄️ PostgreSQL database with Drizzle ORM
- 🧠 LangGraph integration for AI workflows
- 🔗 Solana wallet integration
- 📊 User profile management and chat history
- 📈 OHLCV data collection and technical analysis
- 🔄 Automated data cleanup for optimal performance

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

# Vybe Network API Configuration (for OHLCV data)
VYBE_API_KEY=your_vybe_api_key_here

# Admin API Configuration
ADMIN_API_KEY=your_admin_api_key_here

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

## OHLCV Data Management

The system automatically collects OHLCV (Open, High, Low, Close, Volume) data every 5 minutes for monitored tokens. To prevent database bloat, automated cleanup mechanisms are in place:

### Automated Cleanup

- **Frequency**: Every hour (when cron runs on the hour)
- **Retention Policy**: Keeps the latest 500 records per token (~1.7 days of 5-minute data)
- **Purpose**: Ensures optimal database performance while maintaining sufficient data for technical analysis

### Manual Cleanup via Admin API

You can manually trigger OHLCV data cleanup through the admin API:

#### Count-based Cleanup (Recommended)

```bash
curl -X POST https://your-domain.com/admin/cleanup-ohlcv \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your_admin_api_key" \
  -d '{"method": "count", "keepCount": 500}'
```

#### Time-based Cleanup

```bash
curl -X POST https://your-domain.com/admin/cleanup-ohlcv \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your_admin_api_key" \
  -d '{"method": "days", "retentionDays": 30}'
```

### Configuration

OHLCV data retention settings can be adjusted in `src/constants/database.ts`:

```typescript
export const OHLCV_RETENTION = {
  MAX_RECORDS_PER_TOKEN: 500, // Records to keep per token
  MIN_RECORDS_FOR_ANALYSIS: 50, // Minimum for technical analysis
  CLEANUP_INTERVAL_MINUTES: 60, // Cleanup frequency
} as const;
```

## Deployment

```bash
bun run deploy
```

## API Endpoints

### Core Endpoints

- `GET /` - Health check
- `GET /health` - Health status
- `POST /webhook/telegram` - Telegram webhook
- `POST /webhook/set` - Set webhook URL
- `GET /webhook/info` - Get webhook info

### Admin Endpoints

- `POST /admin/send-message` - Send message to specific user
- `POST /admin/broadcast` - Broadcast message to all users
- `POST /admin/cleanup-ohlcv` - Manual OHLCV data cleanup

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

### Token OHLCV Table

- `token` (Composite Primary Key) - Token address
- `timestamp` (Composite Primary Key) - UNIX timestamp
- `open` - Opening price
- `high` - Highest price
- `low` - Lowest price
- `close` - Closing price
- `volume` - Trading volume

**Performance Features:**

- Composite primary key on (token, timestamp) for efficient queries
- Descending index on timestamp for latest data retrieval
- Automated cleanup to maintain optimal size
- Batch upsert operations for high-throughput data ingestion

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
