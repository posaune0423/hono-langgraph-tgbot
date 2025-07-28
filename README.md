# 🤖 Telegram Bot Template

A **minimal** and **production-ready** Telegram bot template built with modern technologies.

## ✨ Features

- 🔷 **TypeScript** for type safety and better development experience
- 🌐 **Hono** web framework for fast and lightweight API routes
- 🤖 **grammY** for powerful Telegram Bot API integration
- ☁️ **Cloudflare Workers** for serverless deployment
- 🗄️ **Drizzle ORM** with PostgreSQL for database operations
- 📊 **User management** with conversation history
- 🔐 **Admin panel** for broadcast messaging
- 🧪 **Testing** setup with Vitest
- 📦 **Bun** for fast package management and execution

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

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
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   ADMIN_API_KEY=your_admin_api_key_here
   ```

4. **Set up the database**
   ```bash
   bun run db:generate
   bun run db:migrate
   ```

5. **Start development server**
   ```bash
   bun run dev
   ```

### Basic Bot Commands

The template includes these commands out of the box:

- `/start` - Welcome message with inline keyboard
- `/help` - Show available commands and features
- `/stats` - Display user's message statistics
- `/ping` - Test bot responsiveness

## 📁 Project Structure

```
├── src/
│   ├── constants # 諸々の定数を記述, 責務毎に分かりやすい名前のファイルを作成して管理しやすくしてください
│   ├── cron.ts # cron処理で行う処理を記述
│   ├── agents/ # LangGraph agents implementation
│   │   ├── model.ts # LLM model configurations
│   │   └── telegram/ # Telegram-specific agent
│   ├── lib # third-party libraryやlibとして切り出したほうがいいinternalなmoduleなどを格納
│   ├── routes # Honoのroute、APIの各endpointを管理、ある程度の責務でまとめたrouteとして渡す
│   ├── types # Typescriptの型定義
│   ├── utils # globalに使うutil関数
│   └── worker.ts # cloudflare workerのendpoint
├── docs/ # Project documentation
│   └── agents-architecture.md # AI agents architecture guide
├── tests/
│   ├── unit/ # Unit tests
│   └── integration/ # Integration tests
```

For detailed information about the AI agents architecture, see [docs/agents-architecture.md](./docs/agents-architecture.md).

## 🔧 Development

### Available Scripts

```