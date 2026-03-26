# PostHog Integration Report

## Summary

PostHog Node.js analytics is integrated across the API and Auth packages using `posthog-node` v4.18.0. The API package (`@pip/api`) already had a shared client at `packages/api/src/lib/posthog.ts`. The Auth package (`@pip/auth`) received its own client instance and `better-auth` lifecycle hooks to identify users and fire signup events.

### Changes Made

| Package | Change |
|---|---|
| `packages/auth/src/server.ts` | Added PostHog client + `databaseHooks` for user identify & `user_signed_up` |
| `packages/auth/package.json` | Added `posthog-node: ^4.18.0` dependency |
| `.env` | Added `POSTHOG_KEY` and `POSTHOG_HOST` |
| `packages/api/src/lib/ai.ts` | Switched `GoogleGenAI` import to `@posthog/ai` wrapper; passes `posthog` client and `posthogDistinctId` per call |
| `packages/api/src/routers/ai-reports.ts` | Passes `ctx.userId` to `callAI()` so LLM generations are linked to users |
| `packages/api/package.json` | Added `@posthog/ai` dependency |

All other instrumentation (`transaction_*`, `portfolio_*`, `ai_report_*`, exception capture) was pre-existing.

---

## Tracked Events

| Event | Description | File |
|---|---|---|
| `user_signed_up` | New user account created | `packages/auth/src/server.ts` |
| `portfolio_created` | User creates a new portfolio | `packages/api/src/routers/portfolio.ts` |
| `portfolio_deleted` | User deletes a portfolio | `packages/api/src/routers/portfolio.ts` |
| `transaction_bought` | User records a buy transaction | `packages/api/src/routers/transactions.ts` |
| `transaction_sold` | User records a sell transaction | `packages/api/src/routers/transactions.ts` |
| `cash_deposited` | User deposits cash into their portfolio | `packages/api/src/routers/transactions.ts` |
| `cash_withdrawn` | User withdraws cash from their portfolio | `packages/api/src/routers/transactions.ts` |
| `ai_report_generated` | User successfully generates an AI report | `packages/api/src/routers/ai-reports.ts` |
| `ai_report_generation_failed` | AI report generation failed due to an error | `packages/api/src/routers/ai-reports.ts` |

---

## PostHog Dashboard & Insights

**Project:** `357408` — `https://us.posthog.com/project/357408`

**Dashboard:** Analytics basics — https://us.posthog.com/project/357408/dashboard/1400652

| Insight | URL |
|---|---|
| New User Signups | https://us.posthog.com/project/357408/insights/KjEBWNSP |
| Signup to First Investment Funnel | https://us.posthog.com/project/357408/insights/rZgsd8IK |
| Transaction Volume | https://us.posthog.com/project/357408/insights/URthuie5 |
| AI Report Generation | https://us.posthog.com/project/357408/insights/MMVURWVz |
| Portfolio Churn | https://us.posthog.com/project/357408/insights/wUu0BbZh |
| LLM Calls Volume | https://us.posthog.com/project/357408/insights/7dMTopQG |
| LLM Token Usage | https://us.posthog.com/project/357408/insights/NebUuFKb |
| LLM Latency | https://us.posthog.com/project/357408/insights/kCHjQ8Kt |

---

## LLM Analytics

PostHog LLM analytics is enabled via the `@posthog/ai` package, which wraps the Google GenAI client. Every call to `callAI()` automatically emits a `$ai_generation` event capturing:

- `$ai_model` — model name (e.g. `gemini-2.5-flash`)
- `$ai_input_tokens` / `$ai_output_tokens` — token counts
- `$ai_latency` — response time in seconds
- `$ai_input` / `$ai_output_choices` — prompt and response content
- `$ai_total_cost_usd` — estimated cost

Generations are linked to the authenticated user via `posthogDistinctId`. View traces and generations at: https://us.posthog.com/llm-analytics/generations
