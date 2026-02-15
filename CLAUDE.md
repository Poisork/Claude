# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, Claude generates them, and an iframe-based preview renders them in real-time. Built as a Next.js 15 full-stack app with React 19.

## Commands

```bash
npm run setup          # Install deps + Prisma generate + migrate
npm run dev            # Dev server with Turbopack (localhost:3000)
npm run build          # Production build
npm run lint           # ESLint
npm test               # Vitest (all tests)
npm test -- --watch    # Watch mode
npm run db:reset       # Reset SQLite database
npx prisma studio      # Database GUI
```

Uses `NODE_OPTIONS='--require ./node-compat.cjs'` for Node 25+ compatibility (removes Web Storage globals during SSR).

## Architecture

**AI Pipeline:** User prompt → `/api/chat` route → Vercel AI SDK (`ai` package) → Claude Haiku 4.5 via `@ai-sdk/anthropic` → streamed tool calls → virtual file system updates → iframe preview refresh.

**Virtual File System (`/src/lib/file-system.ts`):** All generated code lives in-memory in a `VirtualFileSystem` class. Files are never written to disk. The file system serializes to JSON for database persistence.

**Preview System (`/src/lib/transform/`):** JSX is transpiled client-side via `@babel/standalone`. Imports are resolved through blob URL import maps. The preview HTML is injected into a sandboxed iframe with Tailwind loaded from CDN.

**AI Tools:** Claude has two tools — `str_replace_editor` (create/view/edit files) and `file_manager` (rename/delete). Tool definitions are in `/src/lib/tools/`. Tool execution happens in `FileSystemContext`.

**State Management:** Two React contexts drive the app:
- `ChatContext` — wraps Vercel AI SDK's `useAIChat`, manages messages, calls `/api/chat` with file system state
- `FileSystemContext` — owns the `VirtualFileSystem` instance, handles tool call execution, tracks selected/entry files

**Auth:** JWT-based (via `jose`), stored in HttpOnly cookies, 7-day expiry. Server actions in `/src/actions/` handle signup/signin. Anonymous use is supported.

**Database:** SQLite via Prisma. Two models: `User` and `Project`. Project stores messages and file system data as JSON strings.

**Mock Mode:** When `ANTHROPIC_API_KEY` is absent, a `MockLanguageModel` in `/src/lib/provider.ts` returns static component examples with simulated tool calls.

## Key Conventions

- Path alias: `@/*` maps to `./src/*`
- UI components use shadcn/ui (new-york style, neutral base color, lucide icons)
- Tests live in `__tests__` subdirectories adjacent to source files
- Entry point for generated components: `/App.jsx` (or App.tsx, index.jsx, index.tsx)
- AI system prompt is in `/src/lib/prompts/generation.tsx`
- Max 40 AI tool-use steps (4 in mock mode), 10,000 max tokens per response

## Style

- Use comments sparingly — only comment complex, non-obvious code.

## Environment Variables

- `ANTHROPIC_API_KEY` — enables real Claude API (optional, falls back to mock)
- `JWT_SECRET` — for auth tokens (defaults to `"development-secret-key"` in dev)
