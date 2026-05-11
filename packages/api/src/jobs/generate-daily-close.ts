/**
 * Daily close report generation job.
 *
 * Generates a "daily_close" AI report for every user with an active portfolio,
 * then sends an email notification via Resend.
 *
 * Design:
 *   - Idempotent per (userId × date): skips users who already have a report today.
 *   - Fail-open per user: one failure does not abort the rest.
 *   - Global job lock prevents concurrent runs (e.g. Vercel retry).
 *   - Email is best-effort: failure logs a warning but does not mark the job failed.
 *
 * Trigger:
 *   POST /api/ingest/daily-close          (manual / Vercel Cron)
 *   bun packages/api/src/jobs/generate-daily-close.ts  (local dev)
 */

import { db } from "@pip/db/db";
import { aiReports, users, portfolios } from "@pip/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { callAI, AI_MODEL } from "../lib/ai";
import { sendEmail } from "../lib/email";
import { acquireJobLock, releaseJobLock } from "../lib/redis";
import { dailyCloseReadyEmail } from "../emails/daily-close-ready";
import { getDefaultPortfolio, getHoldings, getPortfolioSummary } from "../services/portfolio";
import { getNewsForTickers } from "../services/news";
import type { PositionWithMetrics } from "../services/portfolio";
import type { NewsItem } from "../providers/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyCloseResult {
  generated: number;
  skipped:   number;
  failed:    number;
  errors:    string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  return `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayUTCStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

// ─── Prompt sections ──────────────────────────────────────────────────────────

function summaryBlock(
  name: string,
  totalValue: number,
  dailyPnl: number,
  dailyPnlPct: number,
  unrealizedPnlPct: number,
  positionCount: number,
  currency: string,
): string {
  return [
    `**Portfolio:** ${name} (${currency})`,
    `**Total Value:** $${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `**Today's P&L:** ${fmtUsd(dailyPnl)} (${fmtPct(dailyPnlPct)})`,
    `**Total Unrealized Return:** ${fmtPct(unrealizedPnlPct)}`,
    `**Positions:** ${positionCount}`,
  ].join("\n");
}

function holdingsTable(holdings: PositionWithMetrics[]): string {
  if (holdings.length === 0) return "_No open positions._";
  return [
    "| Ticker | Mkt Value | Weight | Day % | Day P&L | Total Return |",
    "|--------|----------:|-------:|------:|--------:|-------------:|",
    ...holdings.map((h) =>
      `| **${h.ticker}** | $${h.marketValue.toFixed(0)} | ${h.portfolioWeight.toFixed(1)}% | ${fmtPct(h.dailyChangePct)} | ${fmtUsd(h.dailyPnl)} | ${fmtPct(h.unrealizedPnlPct)} |`,
    ),
  ].join("\n");
}

function notableMoversSection(holdings: PositionWithMetrics[]): string {
  const movers = holdings
    .filter((h) => Math.abs(h.dailyChangePct) >= 1.0)
    .sort((a, b) => Math.abs(b.dailyChangePct) - Math.abs(a.dailyChangePct))
    .slice(0, 6);

  if (movers.length === 0) return "_No significant movers today (all positions < ±1%)._";

  return movers
    .map((h) => {
      const arrow = h.dailyChangePct >= 0 ? "▲" : "▼";
      return `- **${h.ticker}** ${arrow} ${Math.abs(h.dailyChangePct).toFixed(2)}% — ${fmtUsd(h.dailyPnl)} today, ${h.portfolioWeight.toFixed(1)}% of portfolio`;
    })
    .join("\n");
}

function newsContextSection(news: NewsItem[]): string {
  if (news.length === 0) return "_No recent news pulled for today's session._";

  const lines = news.slice(0, 5).map((n, i) => {
    const tag = n.ticker ? ` [${n.ticker}]` : "";
    const sent = n.sentiment === "positive" ? "🟢" : n.sentiment === "negative" ? "🔴" : "⚪";
    return `${i + 1}. ${sent}${tag} **${n.title}** — *${n.source}*`;
  });

  return lines.join("\n");
}

function buildJobPrompt(
  dateStr:   string,
  portfolio: { name: string; currency: string },
  summary:   { totalValue: number; dailyPnl: number; dailyPnlPct: number; unrealizedPnlPct: number; positionCount: number },
  holdings:  PositionWithMetrics[],
  news:      NewsItem[],
): string {
  return `You are a professional portfolio analyst. Write a concise daily close report for ${dateStr}.

## Portfolio Overview
${summaryBlock(portfolio.name, summary.totalValue, summary.dailyPnl, summary.dailyPnlPct, summary.unrealizedPnlPct, summary.positionCount, portfolio.currency)}

## All Positions
${holdingsTable(holdings)}

## Today's Notable Movers
${notableMoversSection(holdings)}

## Relevant News (today's session)
${newsContextSection(news)}

---

Write the Daily Close report. Structure:
1. **Session Summary** (2-3 sentences) — total portfolio performance, tone of day
2. **Key Drivers** (3-4 bullets) — specific positions/news that drove today's P&L; cite prices and % changes
3. **Risk Snapshot** — note any concentration, elevated volatility, or outsized moves to watch
4. **Overnight Watch** (2-3 bullets) — specific events, catalysts, or price levels for tomorrow's open

Keep it under 380 words. Be specific with numbers. No generic disclaimers.`;
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export async function generateDailyClose(): Promise<DailyCloseResult> {
  const lockKey = "lock:job:daily-close";
  const acquired = await acquireJobLock(lockKey, 10 * 60); // 10-min safety TTL

  if (!acquired) {
    console.log("[daily-close] another instance is already running — skipping");
    return { generated: 0, skipped: 1, failed: 0, errors: ["Job already running."] };
  }

  const result: DailyCloseResult = { generated: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const todayStart = todayUTCStart();
    const dateStr    = dateLabel();

    // All distinct user IDs that have at least one portfolio
    const userRows = await db
      .selectDistinct({ userId: portfolios.userId })
      .from(portfolios);

    console.log(`[daily-close] processing ${userRows.length} user(s) for ${dateStr}`);

    for (const { userId } of userRows) {
      try {
        // ── Idempotency check ───────────────────────────────────────────────
        const existing = await db
          .select({ id: aiReports.id })
          .from(aiReports)
          .where(
            and(
              eq(aiReports.userId, userId),
              eq(aiReports.type, "daily_close"),
              gte(aiReports.createdAt, todayStart),
            ),
          )
          .limit(1);

        if (existing[0]) {
          console.log(`[daily-close] skipping ${userId} — report already exists`);
          result.skipped++;
          continue;
        }

        // ── Fetch portfolio context ─────────────────────────────────────────
        const portfolio = await getDefaultPortfolio(userId);
        if (!portfolio) { result.skipped++; continue; }

        const [holdings, summary] = await Promise.all([
          getHoldings(portfolio.id),
          getPortfolioSummary(portfolio.id, userId),
        ]);

        if (holdings.length === 0 || !summary) { result.skipped++; continue; }

        const tickers = holdings.map((h) => h.ticker);
        const news    = await getNewsForTickers(tickers, 5).catch(() => [] as NewsItem[]);

        // ── Persist pending record ──────────────────────────────────────────
        const reportId = newId();
        const title    = `Daily Close — ${dateStr}`;

        await db.insert(aiReports).values({
          id:          reportId,
          userId,
          portfolioId: portfolio.id,
          type:        "daily_close",
          title,
          model:       AI_MODEL,
          status:      "pending",
          content:     "",
        });

        // ── Generate ────────────────────────────────────────────────────────
        const prompt = buildJobPrompt(dateStr, portfolio, summary, holdings, news);

        let content: string;
        let tokensUsed: number | null = null;

        try {
          const ai = await callAI(prompt);
          content    = ai.content;
          tokensUsed = ai.tokensUsed;
        } catch (aiErr) {
          await db
            .update(aiReports)
            .set({ status: "failed", content: `Generation failed: ${String(aiErr)}` })
            .where(eq(aiReports.id, reportId));
          throw aiErr;
        }

        await db
          .update(aiReports)
          .set({ status: "completed", content, tokensUsed, model: AI_MODEL })
          .where(eq(aiReports.id, reportId));

        console.log(`[daily-close] ✓ ${userId} — report ${reportId} (${tokensUsed ?? "?"} tokens)`);

        // ── Email notification ──────────────────────────────────────────────
        const userRow = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (userRow[0]) {
          const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          const preview = content.replace(/#{1,6}\s+/g, "").replace(/\*{1,2}/g, "").slice(0, 200);
          const email   = dailyCloseReadyEmail({
            userName:    userRow[0].name,
            reportTitle: title,
            reportUrl:   `${appUrl}/reports`,
            dateStr,
            preview,
          });

          await sendEmail({ to: userRow[0].email, ...email }).catch((emailErr) => {
            console.warn(`[daily-close] email failed for ${userId}:`, emailErr);
          });
        }

        result.generated++;
      } catch (userErr) {
        result.failed++;
        result.errors.push(`${userId}: ${String(userErr)}`);
        console.error(`[daily-close] ✗ ${userId}:`, userErr);
      }
    }
  } finally {
    await releaseJobLock(lockKey);
  }

  console.log(
    `[daily-close] done — generated=${result.generated} skipped=${result.skipped} failed=${result.failed}`,
  );
  return result;
}

// ─── Standalone runner (bun packages/api/src/jobs/generate-daily-close.ts) ───

if (import.meta.main) {
  generateDailyClose()
    .then((r) => { console.log("Result:", r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
