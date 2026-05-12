import YahooFinance from "yahoo-finance2";
import { db } from "@pip/db/db";
import { securities, priceSnapshots } from "@pip/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

// v3: instantiate; pass notices to suppress in constructor
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const DELAY_MS = 200;
const BATCH_SIZE = 100;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function assetClassFromQuoteType(
  quoteType?: string | null,
): "equity" | "etf" | "bond" | "crypto" | "commodity" {
  switch (quoteType?.toUpperCase()) {
    case "ETF":
    case "MUTUALFUND":
      return "etf";
    case "CRYPTOCURRENCY":
      return "crypto";
    case "FUTURE":
      return "commodity";
    default:
      return "equity";
  }
}

/**
 * Fetches sector, industry, market cap, and basic metadata from Yahoo Finance
 * and upserts into the securities table. Run before fetchDailyBars.
 */
export async function fetchSecurityMetadata(tickers: string[]): Promise<void> {
  for (const ticker of tickers) {
    const upper = ticker.toUpperCase();
    try {
      await delay(DELAY_MS);

      const summary = await yf.quoteSummary(upper, {
        modules: ["price", "assetProfile"],
      });

      const price = summary.price;
      const profile = summary.assetProfile;

      await db
        .insert(securities)
        .values({
          id: crypto.randomUUID(),
          ticker: upper,
          name: price?.longName ?? price?.shortName ?? upper,
          assetClass: assetClassFromQuoteType(price?.quoteType),
          sector: profile?.sector ?? null,
          industry: profile?.industry ?? null,
          exchange: price?.exchange ?? null,
          currency: price?.currency ?? "USD",
          marketCap:
            price?.marketCap != null ? String(price.marketCap) : null,
        })
        .onConflictDoUpdate({
          target: securities.ticker,
          set: {
            name: sql`excluded.name`,
            sector: sql`excluded.sector`,
            industry: sql`excluded.industry`,
            exchange: sql`excluded.exchange`,
            currency: sql`excluded.currency`,
            marketCap: sql`excluded.market_cap`,
            updatedAt: new Date(),
          },
        });

      console.log(`✓ Metadata: ${upper}`);
    } catch (err) {
      console.error(
        `✗ Metadata failed for ${upper}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Fetches daily OHLCV bars from Yahoo Finance and upserts into price_snapshots.
 * Requires securities to already exist (run fetchSecurityMetadata first).
 */
export async function fetchDailyBars(
  tickers: string[],
  lookbackDays: number,
): Promise<void> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);

  const upper = tickers.map((t) => t.toUpperCase());

  // Build ticker → securityId map in one query
  const secRows = await db
    .select({ ticker: securities.ticker, id: securities.id })
    .from(securities)
    .where(inArray(securities.ticker, upper));

  const secMap = new Map(secRows.map((r) => [r.ticker, r.id]));

  for (const ticker of upper) {
    const secId = secMap.get(ticker);
    if (!secId) {
      console.warn(
        `⚠ Security not found for ${ticker} — run fetchSecurityMetadata first`,
      );
      continue;
    }

    try {
      await delay(DELAY_MS);

      const result = await yf.chart(ticker, {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });

      const bars = result.quotes.filter((q) => q.close != null);

      if (bars.length === 0) {
        console.warn(`⚠ No bars returned for ${ticker}`);
        continue;
      }

      // Upsert in batches to avoid hitting Postgres parameter limits
      for (let i = 0; i < bars.length; i += BATCH_SIZE) {
        const batch = bars.slice(i, i + BATCH_SIZE);
        const values = batch.map((bar) => ({
          id: crypto.randomUUID(),
          securityId: secId,
          date: toDateStr(bar.date),
          open: bar.open != null ? String(bar.open) : null,
          high: bar.high != null ? String(bar.high) : null,
          low: bar.low != null ? String(bar.low) : null,
          close: String(bar.close!),
          adjClose: bar.adjclose != null ? String(bar.adjclose) : null,
          volume: bar.volume ?? null,
          source: "yahoo" as const,
        }));

        await db
          .insert(priceSnapshots)
          .values(values)
          .onConflictDoUpdate({
            target: [priceSnapshots.securityId, priceSnapshots.date],
            set: {
              open: sql`excluded.open`,
              high: sql`excluded.high`,
              low: sql`excluded.low`,
              close: sql`excluded.close`,
              adjClose: sql`excluded.adj_close`,
              volume: sql`excluded.volume`,
              source: sql`excluded.source`,
            },
          });
      }

      console.log(`✓ Prices: ${ticker} (${bars.length} bars)`);
    } catch (err) {
      console.error(
        `✗ Prices failed for ${ticker}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Ensures a ticker has 365 days of price history in the DB.
 * Also ensures SPY is seeded — required for beta calculations in the risk router.
 * No-op for tickers that already have sufficient history (≥ 30 days).
 * Safe to call as a fire-and-forget background task.
 */
export async function backfillPriceHistory(ticker: string): Promise<void> {
  const t = ticker.toUpperCase();

  async function countHistory(secId: string): Promise<number> {
    const rows = await db
      .select({ id: priceSnapshots.id })
      .from(priceSnapshots)
      .where(eq(priceSnapshots.securityId, secId))
      .limit(30);
    return rows.length;
  }

  const tickersToSeed: string[] = [];

  // Check the requested ticker
  const secRow = await db
    .select({ id: securities.id })
    .from(securities)
    .where(eq(securities.ticker, t))
    .limit(1);

  if (secRow[0] && (await countHistory(secRow[0].id)) < 30) {
    tickersToSeed.push(t);
  }

  // Check SPY benchmark (needed for beta)
  const spyRow = await db
    .select({ id: securities.id })
    .from(securities)
    .where(eq(securities.ticker, "SPY"))
    .limit(1);

  if (!spyRow[0]) {
    await fetchSecurityMetadata(["SPY"]);
    tickersToSeed.push("SPY");
  } else if ((await countHistory(spyRow[0].id)) < 30) {
    tickersToSeed.push("SPY");
  }

  if (tickersToSeed.length === 0) return;

  console.log(`[backfill] seeding 365d history for: ${tickersToSeed.join(", ")}`);
  await fetchDailyBars(tickersToSeed, 365);
  console.log(`[backfill] ✓ done (${tickersToSeed.join(", ")})`);
}
