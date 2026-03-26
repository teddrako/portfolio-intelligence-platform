/**
 * Ingestion job: daily EOD price snapshots.
 *
 * Fetches quotes for every security in the `securities` table,
 * writes/upserts a price_snapshots row, and caches each quote in Redis.
 *
 * Run this once per trading day after market close.
 *
 * TODO: wire to a real cron trigger (Vercel Cron, GitHub Actions, etc.)
 *       and set MARKET_DATA_PROVIDER + vendor API key.
 *
 * Manual trigger (dev): POST /api/ingest/prices
 */

import { db } from "@pip/db/db";
import { securities, priceSnapshots } from "@pip/db/schema";
import { sql } from "drizzle-orm";
import { getMarketDataProvider } from "../providers/market-data";

function newId(): string {
  return `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function ingestPrices(): Promise<{ upserted: number; skipped: number; errors: string[] }> {
  const provider = getMarketDataProvider();
  const date     = todayStr();

  // Fetch all tracked securities
  const rows = await db.select({ id: securities.id, ticker: securities.ticker }).from(securities);
  if (rows.length === 0) return { upserted: 0, skipped: 0, errors: [] };

  const tickers = rows.map((r) => r.ticker);
  const tickerToId = Object.fromEntries(rows.map((r) => [r.ticker, r.id]));

  const quotes = await provider.getQuotes(tickers);

  let upserted = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const [ticker, quote] of quotes) {
    const securityId = tickerToId[ticker];
    if (!securityId) { skipped++; continue; }

    try {
      await db
        .insert(priceSnapshots)
        .values({
          id:         newId(),
          securityId,
          date,
          open:       String(quote.price),      // intraday — use price as open proxy
          high:       String(quote.dayHigh),
          low:        String(quote.dayLow),
          close:      String(quote.price),
          adjClose:   String(quote.price),
          volume:     quote.volume,
          source:     provider.name,
        })
        .onConflictDoUpdate({
          target:     [priceSnapshots.securityId, priceSnapshots.date],
          set:        {
            high:     sql`excluded.high`,
            low:      sql`excluded.low`,
            close:    sql`excluded.close`,
            adjClose: sql`excluded.adj_close`,
            volume:   sql`excluded.volume`,
          },
        });
      upserted++;
    } catch (err) {
      errors.push(`${ticker}: ${String(err)}`);
    }
  }

  console.log(`[ingest-prices] upserted=${upserted} skipped=${skipped} errors=${errors.length}`);
  return { upserted, skipped, errors };
}
