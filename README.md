# Portfolio Intelligence Platform

A personal investment terminal. Track your portfolio, run DCF valuations, analyze options, stress-test risk, and get AI-generated reports — all in one place.

Built for investors who want institutional-grade analysis tools without a Bloomberg subscription.

---

## What it does

### Portfolio & P&L
Track every position in real time. See unrealized gains, daily P&L, cost basis, and portfolio weight for each holding. A 30-day chart shows how your total portfolio value has moved.

### DCF Valuation
Run a full discounted cash-flow model on any stock. The valuation engine pulls 5 years of income statement, cash flow, and balance sheet data (via Financial Modeling Prep) and builds a FCFF model:

- **FCFF** = EBIT × (1 − tax rate) + D&A − CapEx
- **WACC** built from CAPM: cost of equity (RFR + β × ERP) blended with after-tax cost of debt
- Adjustable assumptions: WACC, terminal growth rate, projection years, FCF growth rate
- 5×5 sensitivity grid showing intrinsic value across WACC / terminal growth combinations
- EV multiples: EV/EBITDA, EV/Revenue, EV/FCF, P/E
- Export to CSV for further analysis in Excel

### Options Chain
Live options data for any ticker. See calls and puts side by side with bid/ask, implied volatility, delta, gamma, theta, and open interest. Centered on at-the-money strikes so you're not scrolling through 50 rows to find where the action is. Includes a payoff diagram for building and visualizing positions.

### Risk Analytics
Portfolio-level risk metrics computed from price history:

- **Beta** vs. SPY with a 30-day rolling chart
- **Annualized volatility** and **maximum drawdown** 
- **Sector exposure** — your weights vs. SPY benchmark weights
- **Correlation matrix** across all holdings
- **Drawdown series** chart

### AI Reports
Generate analyst-style reports in seconds, powered by Gemini:

- **Morning Brief** — pre-market positioning and key levels to watch
- **Daily Close** — session recap, P&L attribution, overnight watchlist
- **Portfolio Summary** — overall health, top performers, concentration risk
- **Security Analysis** — deep-dive on a single holding
- **Risk Preview** — scenario analysis and concentration warnings

### News Intelligence
Headlines scored by AI for relevance to your specific portfolio. An article about a Fed rate decision scores differently if you hold heavy financials vs. pure tech. Filter by sentiment, category (earnings, macro, policy, rates, FX), and holdings.

### Backtesting
Test strategies against up to 1 year of price history:

- **Buy & Hold** — baseline for any comparison
- **SMA Crossover** — configurable fast/slow moving averages
- **Momentum** — top-N performers rebalanced monthly
- **Mean Reversion** — entry/exit thresholds around a moving average

### Earnings & Macro Calendar
Upcoming earnings for your holdings and key macro events (CPI, NFP, FOMC, GDP) in one view, grouped by week.

---

## Tech stack

| Layer | Choice |
|---|---|
| Web | Next.js 15 (App Router) + TypeScript |
| API | tRPC v11 + Zod |
| Database | Drizzle ORM + PostgreSQL (Neon) |
| Auth | Better Auth v1 |
| Market data | Yahoo Finance (real-time quotes, price history) |
| Fundamentals | Financial Modeling Prep (income statement, cash flow, balance sheet) |
| Calendar | Finnhub (earnings calendar, economic events) |
| AI | Google Gemini 2.5 Flash |
| Cache | Upstash Redis |
| Monorepo | Turborepo + pnpm workspaces |

---

## Setup

### Prerequisites
- [pnpm](https://pnpm.io/) v9+ — `npm install -g pnpm`
- Node.js 20+
- A PostgreSQL database ([Neon](https://neon.tech) free tier works)

### Environment variables

Copy `.env.example` to `.env` at the repo root and fill in:

```bash
# Required
DATABASE_URL=                  # PostgreSQL connection string

# Auth
BETTER_AUTH_SECRET=            # Any random 32+ char string
BETTER_AUTH_URL=               # http://localhost:3000 for local dev

# Market data (free tiers available on all)
FMP_API_KEY=                   # financialmodelingprep.com — DCF fundamentals
FINNHUB_API_KEY=               # finnhub.io — earnings + macro calendar

# AI reports
GEMINI_API_KEY=                # Google AI Studio — ai.google.dev

# Optional but recommended
UPSTASH_REDIS_REST_URL=        # Caches quotes (60s), news (5min), history (1h)
UPSTASH_REDIS_REST_TOKEN=
```

Market data (Yahoo Finance) works without any API key. FMP and Finnhub both have free tiers sufficient for personal use.

### Install and run

```bash
pnpm install

# Apply database schema
pnpm --filter=@pip/db db:push

# Seed initial securities + price data
pnpm --filter=@pip/db db:seed

# Start the web app on http://localhost:3000
pnpm dev --filter=@pip/web
```

---

## Project layout

```
portfolio-intelligence-platform/
├── apps/
│   └── web/              Next.js app — UI + /api/trpc endpoint
├── packages/
│   ├── api/              tRPC routers, services, data providers
│   ├── db/               Drizzle schema + migrations
│   ├── auth/             Better Auth config
│   └── ui/               Shared React components
```

---

## Development commands

```bash
pnpm dev                          # Start all apps
pnpm dev --filter=@pip/web        # Web app only
pnpm typecheck                    # Type-check everything
pnpm build                        # Production build
pnpm add <pkg> --filter=@pip/api  # Add dep to a specific package
```
