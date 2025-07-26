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
│   ├── constants/          # Application constants
│   ├── db/                 # Database schema and configuration
│   │   └── schema/         # Drizzle ORM schemas
│   ├── lib/
│   │   └── telegram/       # Telegram bot utilities
│   ├── routes/             # API endpoints
│   │   ├── admin.ts        # Admin panel routes
│   │   └── webhook.ts      # Telegram webhook handler
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── worker.ts           # Cloudflare Workers entry point
├── tests/                  # Test files
└── scripts/                # Utility scripts
```

## 🔧 Development

### Available Scripts

```bash
# Development
bun run dev              # Start development server
bun run build            # Build for production

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:seed          # Seed database (optional)

# Testing
bun run test:unit        # Run unit tests
bun run test:watch       # Run tests in watch mode

# Code Quality
bun run format           # Format code with Biome
bun run lint             # Lint code with Biome
bun run ci               # Run format + lint
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `ADMIN_API_KEY` | API key for admin endpoints | ✅ |

## 🚀 Deployment

### Cloudflare Workers

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Configure wrangler.toml**
   ```toml
   name = "your-bot-name"
   compatibility_date = "2024-01-01"
   
   [vars]
   # Add your environment variables here
   ```

3. **Deploy**
   ```bash
   bun run deploy
   ```

### Other Platforms

This template can be deployed to any platform that supports Node.js:
- Vercel
- Railway
- Heroku
- DigitalOcean App Platform

## 📡 Admin Panel

The template includes admin endpoints for managing the bot:

### Send Message to User
```bash
POST /admin/send-message
{
  "userId": "123456789",
  "message": "Hello from admin!",
  "parseMode": "Markdown"
}
```

### Broadcast Message to All Users
```bash
POST /admin/broadcast
{
  "message": "📢 Important announcement!",
  "parseMode": "HTML",
  "excludeUserIds": ["123456789"]
}
```

## 🔨 Customization

### Adding New Commands

1. **Add command handler in `src/lib/telegram/command.ts`:**
   ```typescript
   bot.command("mycommand", async (ctx) => {
     await ctx.reply("My custom response!");
   });
   ```

2. **Add business logic in `src/lib/telegram/handler.ts`** for message processing

3. **Update database schema** if needed in `src/db/schema/`

### Database Schema

The template includes two main tables:
- **users** - User profiles and preferences
- **messages** - Conversation history

Extend these schemas or add new ones in `src/db/schema/`.

## 🧪 Testing

```bash
# Run all tests
bun run test:unit

# Run specific test file
bun test tests/unit/utils/db.test.ts

# Run tests in watch mode
bun run test:watch
```

## 📋 Features Included

✅ **Bot Infrastructure**
- Webhook handling with grammY
- Error handling and logging
- Rate limiting for broadcasts
- Admin authentication

✅ **Database Integration**
- User management
- Message history
- Type-safe queries with Drizzle ORM

✅ **Admin Features**
- Send messages to specific users
- Broadcast to all users
- User statistics

✅ **Developer Experience**
- TypeScript for type safety
- Modern tooling (Bun, Biome)
- Comprehensive testing setup
- Well-structured project organization

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the Telegram bot development community**
