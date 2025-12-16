# 🦜🔗🔥 Telegram Bot Template

A **minimal** and **production-ready** Telegram bot template built with **🦜🔗 LangGraph** and **🔥 Hono**.

## ✨ Features

- 🔷 **TypeScript** for type safety and better development experience
- 🔥 **Hono** web framework for fast and lightweight API routes
- 🤖 **grammY** for powerful Telegram Bot API integration
- ☁️ **Cloudflare Workers** for serverless deployment
- 🗄️ **Drizzle ORM** with **Cloudflare D1 SQLite** for database operations
- 🦜🔗 **LangGraph** for AI agent workflows
- 📊 **User management** with conversation history
- 🔐 **Admin panel** for broadcast messaging
- 🧪 **Testing** setup with Vitest
- 📦 **Bun** for fast package management and execution

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for Cloudflare Workers deployment
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Cloudflare account for D1 database

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd hono-langgraph-tgbot
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   ```bash
   cp .dev.vars.example .dev.vars
   ```

   Edit `.dev.vars` with your configuration:

   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ADMIN_API_KEY=your_admin_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   CRON_SECRET=your_cron_secret_here

   # For D1 database management (get these from Cloudflare dashboard)
   CLOUDFLARE_ACCOUNT_ID=your_account_id
   CLOUDFLARE_DATABASE_ID=your_database_id
   CLOUDFLARE_D1_TOKEN=your_d1_token
   ```

4. **Set up Cloudflare D1 database**

   First, create a D1 database:

   ```bash
   # Create a new D1 database
   npx wrangler d1 create hono-langgraph-tgbot
   ```

   Copy the database ID from the output and update `wrangler.jsonc`:

   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "hono-langgraph-tgbot",
       "database_id": "your-database-id-here", // Replace with actual ID
       "migrations_dir": "migrations"
     }
   ]
   ```

5. **Generate and run database migrations**

   ```bash
   # Generate migration files
   bun run db:generate

   # Apply migrations to local D1 database
   npx wrangler d1 migrations apply hono-langgraph-tgbot --local

   # Apply migrations to remote D1 database (for production)
   npx wrangler d1 migrations apply hono-langgraph-tgbot --remote
   ```

6. **Start development server**
   ```bash
   bun run dev
   ```

## 🗄️ Database Management

This project uses **Cloudflare D1**, a serverless SQLite database that's globally distributed and scales automatically.

### Database Commands

```bash
# Generate migration files from schema changes
bun run db:generate

# Apply migrations to local database
npx wrangler d1 migrations apply hono-langgraph-tgbot --local

# Apply migrations to production database
npx wrangler d1 migrations apply hono-langgraph-tgbot --remote

# Open Drizzle Studio (local database viewer)
bun run db:studio

# Execute SQL commands directly
npx wrangler d1 execute hono-langgraph-tgbot --command="SELECT * FROM users"
```

### Database Schema

The application includes two main tables:

- **`users`**: Telegram user profiles and interaction state
- **`messages`**: Conversation history for AI agents

### Local vs Production Database

- **Local**: Uses a local SQLite file for development
- **Production**: Uses Cloudflare D1 distributed database
- **Migrations**: Apply to both environments separately

## 🤖 Telegram Bot Setup

### Creating Your Bot

1. **Create a new bot with BotFather**
   - Open Telegram and search for [@BotFather](https://t.me/botfather)
   - Send `/newbot` command
   - Follow the instructions to name your bot
   - Save the bot token provided by BotFather

2. **Add bot token to environment**
   ```bash
   # Add to your .dev.vars file
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

### Setting Up Webhook (After Deployment)

After deploying your bot to Cloudflare Workers, you need to set up the webhook URL so Telegram can send updates to your bot.

#### Method 1: Using Telegram Bot API directly

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_DOMAIN>/webhook/telegram"
```

Replace:

- `<YOUR_BOT_TOKEN>` with your actual bot token
- `<YOUR_DOMAIN>` with your deployed Cloudflare Workers domain

#### Method 2: Using the internal webhook endpoint

```bash
curl -X POST https://your-domain.com/webhook/set \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook/telegram"}'
```

#### Verify Webhook Setup

You can verify that your webhook is properly configured by checking the webhook info:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

This should return information about your configured webhook, including the URL and whether it's working properly.

### Local Development with ngrok

For local development and testing, you can use [ngrok](https://ngrok.com/) to expose your local server to the internet, allowing Telegram to send webhooks to your development environment.

#### Setting up ngrok

1. **Install ngrok**

   ```bash
   # Using Homebrew (macOS)
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. **Start your local development server**

   ```bash
   bun run dev
   ```

   Your server will typically run on `http://localhost:8787`

3. **Expose your local server with ngrok**

   ```bash
   # Expose port 8787 (default Cloudflare Workers dev port)
   ngrok http 8787
   ```

   ngrok will provide you with a public URL like: `https://abc123.ngrok.io`

4. **Set webhook to your ngrok URL**

   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://abc123.ngrok.io/webhook/telegram"
   ```

5. **Test your bot**
   - Send messages to your bot in Telegram
   - Check ngrok's web interface at `http://localhost:4040` to see incoming requests
   - Monitor your development server logs for debugging

#### Tips for ngrok Development

- **Persistent URLs**: Consider using ngrok's paid plan for consistent URLs across sessions
- **HTTPS Required**: Telegram webhooks require HTTPS, which ngrok provides automatically
- **Request Inspection**: Use ngrok's web interface (`localhost:4040`) to inspect webhook payloads
- **Webhook Reset**: Remember to update your webhook URL each time you restart ngrok (unless using a persistent domain)

#### Alternative: Skip Webhooks for Local Development

If you prefer not to use webhooks during development, you can modify your bot to use polling instead:

```typescript
// For development only - add this to your local setup
if (process.env.NODE_ENV === "development") {
  bot.start(); // Uses polling instead of webhooks
}
```

Note: This approach won't work with Cloudflare Workers in production, but it's useful for local testing.

### Basic Bot Commands

The template includes these commands out of the box:

- `/start` - Welcome message with inline keyboard
- `/help` - Show available commands and features
- `/stats` - Display user's message statistics
- `/ping` - Test bot responsiveness

## 📁 Project Structure

```text
├── src/
│   ├── constants # 諸々の定数を記述, 責務毎に分かりやすい名前のファイルを作成して管理しやすくしてください
│   ├── cron.ts # cron処理で行う処理を記述
│   ├── agents/ # 🦜🔗 LangGraph agents implementation
│   │   ├── model.ts # LLM model configurations
│   │   └── telegram/ # Telegram-specific agent
│   ├── lib # third-party libraryやlibとして切り出したほうがいいinternalなmoduleなどを格納
│   ├── routes # 🔥 Honoのroute、APIの各endpointを管理、ある程度の責務でまとめたrouteとして渡す
│   ├── types # Typescriptの型定義
│   ├── utils # globalに使うutil関数
│   └── worker.ts # cloudflare workerのendpoint
├── docs/ # Project documentation
│   └── agents-architecture.md # 🦜🔗 AI agents architecture guide
├── tests/
│   ├── unit/ # Unit tests
│   └── integration/ # Integration tests
```

For detailed information about the AI agents architecture, see [docs/agents-architecture.md](./docs/agents-architecture.md).

## 🚀 Deployment

### Deploy to Cloudflare Workers

1. **Build and deploy**

   ```bash
   bun run deploy
   ```

2. **Apply database migrations to production**

   ```bash
   npx wrangler d1 migrations apply hono-langgraph-tgbot --remote
   ```

3. **Set up production environment variables**

   In Cloudflare Workers dashboard or using Wrangler CLI, add these secrets:

   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put ADMIN_API_KEY
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put TAVILY_API_KEY
   npx wrangler secret put CRON_SECRET
   ```

4. **Configure webhook URL** (see Telegram Bot Setup section below)

### Environment Management

- **Local**: Uses `.dev.vars` file for development
- **Production**: Uses Cloudflare Workers secrets
- **Database**: Separate D1 instances for local and production

## 🔧 Development

### Available Scripts

```bash
# Development
bun run dev                    # Start development server
bun run build                  # Build for production

# Database operations
bun run db:generate           # Generate migration files
bun run db:studio             # Open Drizzle Studio
npx wrangler d1 migrations apply hono-langgraph-tgbot --local  # Apply migrations locally
npx wrangler d1 migrations apply hono-langgraph-tgbot --remote # Apply migrations to production

# Testing
bun run test                  # Run all tests
bun run test:unit            # Run unit tests only
bun run test:integration     # Run integration tests only

# Deployment
bun run deploy               # Deploy to Cloudflare Workers
bun run cf-typegen          # Generate Cloudflare bindings types

# Utilities
bun run format              # Format code with Prettier
bun run lint                # Lint and fix code issues
bun run ci                  # Run format and lint checks

# Cron and Admin
bun run cron:run            # Test cron job locally
bun run broadcast           # Test broadcast functionality
```

### Database Migration Workflow

When making schema changes:

1. **Modify schema files** in `src/db/schema/`
2. **Generate migration**: `bun run db:generate`
3. **Apply to local DB**: `npx wrangler d1 migrations apply hono-langgraph-tgbot --local`
4. **Test locally**: `bun run dev`
5. **Deploy to production**: `bun run deploy`
6. **Apply to production DB**: `npx wrangler d1 migrations apply hono-langgraph-tgbot --remote`

## 🦜🔗 AI Agents Integration

This template includes **🦜🔗 LangGraph-powered AI agents** for intelligent conversation handling, built on top of **🔥 Hono** for blazing-fast API routes.

### Features

- 📝 **Multi-turn conversations** with memory
- 🔍 **External data integration** (Tavily search, APIs)
- 🧠 **Context-aware responses** using conversation history
- 🎯 **Specialized nodes** for different types of queries
- 🔄 **Workflow orchestration** with conditional routing

### Agent Architecture

- **General Node**: Handles general conversation and queries
- **Data Fetch Node**: Retrieves external data and user preferences
- **Manager Node**: Orchestrates complex workflows

### Tech Stack Highlights

- **🦜🔗 LangGraph**: Powerful AI agent framework for building stateful, multi-actor applications
- **🔥 Hono**: Ultra-fast web framework perfect for Cloudflare Workers

For detailed information about the AI agents architecture, see [docs/agents-architecture.md](./docs/agents-architecture.md).
