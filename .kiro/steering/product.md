# Product Steering

## Purpose

A production-ready Telegram bot template that combines LangGraph AI agents with Hono web framework, designed for Cloudflare Workers serverless deployment.

## Value Proposition

- **Minimal yet complete**: Provides essential bot functionality without bloat
- **AI-powered conversations**: Multi-turn conversations with memory using LangGraph
- **Serverless-first**: Optimized for Cloudflare Workers edge deployment
- **Type-safe**: Full TypeScript with strict type checking
- **Production-ready**: Includes testing, error handling, logging, and database management

## Core Capabilities

### Primary Features

1. **Telegram Bot Integration**
   - Webhook-based message handling via grammY
   - Command system (`/start`, `/help`, `/stats`, `/ping`)
   - User management with conversation history

2. **AI Agent System**
   - LangGraph-powered conversation workflows
   - Multi-turn conversations with persistent memory
   - Context-aware responses using conversation history
   - Support for multiple LLM providers (OpenAI, Groq)

3. **Database Management**
   - Cloudflare D1 (SQLite) for data persistence
   - Drizzle ORM for type-safe database operations
   - User profiles and message history storage

4. **Admin Features**
   - Broadcast messaging capability
   - Admin API authentication

5. **Operational Features**
   - Scheduled cron tasks (every 5 minutes)
   - Health check endpoints
   - Structured logging with configurable levels

## Design Principles

- **Simplicity**: Keep the codebase minimal and focused
- **Type Safety**: Leverage TypeScript's type system for reliability
- **Testability**: Dependency injection patterns for external services
- **Serverless Optimization**: Design for Cloudflare Workers constraints
- **Maintainability**: Clear separation of concerns and modular structure

## Extension Points

- Add new LangGraph nodes for specialized workflows
- Extend command system with custom bot commands
- Integrate additional LLM providers or tools
- Add new database schemas for extended functionality
