# Portfolio Intelligence Platform

An AI-native market intelligence hub. Know what you own, why it moves, and what to watch next.

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js 15 (App Router) + TypeScript |
| Mobile | Expo 52 + Expo Router 4 + TypeScript |
| API | tRPC v11 + Zod (served by `apps/web`) |
| Shared UI | `packages/ui` — React 18/19 compatible |
| Database | Drizzle ORM + PostgreSQL (Neon) — mock data in dev |
| Auth | Better Auth v1 |
| Monorepo | Turborepo + pnpm workspaces |

## Workspace Layout

```
portfolio-intelligence-platform/
├── apps/
│   ├── web/          Next.js web app — serves /api/trpc and the dashboard UI
│   └── mobile/       Expo React Native app
├── packages/
│   ├── api/          tRPC routers + AppRouter type (shared by web + mobile)
│   ├── auth/         Better Auth config + session types
│   ├── config/       Shared TypeScript configs
│   ├── db/           Drizzle schema definitions + mock data
│   └── ui/           Shared React components (Button, Card, Badge)
```

## Prerequisites

- [pnpm](https://pnpm.io/) v9+ — `npm install -g pnpm`
- Node.js 20+
- For mobile: Xcode (iOS) or Android Studio

## Setup

```bash
# 1. Install all dependencies
pnpm install

# 2. Copy environment file
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — DATABASE_URL is only needed for real DB access

# 3. Start the web app (runs on http://localhost:3000)
pnpm dev --filter=@pip/web

# 4. Start the mobile app (in a separate terminal)
pnpm dev --filter=@pip/mobile
```

## Development Commands

```bash
# Run all apps in dev mode
pnpm dev

# Run only the web app
pnpm dev --filter=@pip/web

# Run only the mobile app
pnpm dev --filter=@pip/mobile

# Type-check everything
pnpm typecheck

# Build for production
pnpm build

# Add a dependency to a specific package
pnpm add <package> --filter=@pip/web
pnpm add <package> --filter=@pip/db
```

## tRPC API

The API is defined in `packages/api` and served by `apps/web` at `/api/trpc`.

**Available procedures:**

```
portfolio.summary     → Portfolio totals, P&L, daily change
portfolio.holdings    → All holdings with live-like metrics
portfolio.detail      → Portfolio metadata
securities.list       → Master list of securities
securities.byTicker   → Single security by ticker
news.list             → Recent news, filterable by limit
news.byTicker         → News filtered to a specific ticker
```

**Server Component usage (RSC):**
```ts
import { trpc } from "@/trpc/server"

export default async function Page() {
  const caller = trpc()
  const summary = await caller.portfolio.summary()
}
```

**Client Component usage:**
```ts
"use client"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"

export function PortfolioValue() {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.portfolio.summary.queryOptions())
  return <div>{data?.totalValue}</div>
}
```

## Mock Data

All data is mocked in `packages/db/src/mock/index.ts`. The mock portfolio holds 8 positions (NVDA, META, SPY, MSFT, AMZN, AAPL, JPM, GOOGL) with realistic prices and P&L calculations. Swap mock data imports in `packages/api/src/routers/` with real Drizzle queries when you have a database connected.

## Connecting a Real Database

1. Provision a PostgreSQL database (recommended: [Neon](https://neon.tech))
2. Set `DATABASE_URL` in `apps/web/.env.local`
3. Generate migrations: `pnpm --filter=@pip/db db:generate`
4. Run migrations: `pnpm --filter=@pip/db db:migrate`
5. Replace mock data imports in `packages/api/src/routers/` with real Drizzle queries

## Roadmap

**MVP v1 (current)** — Portfolio overview, holdings table, news feed, tRPC API scaffold, mock data

**MVP v2** — Macro dashboard, event relevance scoring, exposure mapping by sector, watchlists

**MVP v3** — Daily AI close notes, custom AI reports, scenario analysis, alerting
