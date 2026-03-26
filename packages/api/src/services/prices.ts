/**
 * Market-data service — thin caching + aggregation layer over IMarketDataProvider.
 *
 * All functions are async and go through Redis (fail-open).
 * Swap the underlying vendor via the MARKET_DATA_PROVIDER env var without
 * touching this file.
 */

import { getMarketDataProvider } from "../providers/market-data";
import { withCache } from "../lib/redis";
import type { Quote, HistoricalBar } from "../providers/types";

export type { Quote, HistoricalBar };

// Re-export for backward-compat with portfolio.ts callers.
export interface PriceData {
  price:         number;
  previousClose: number;
  change:        number;
  changePct:     number;
}

const provider = getMarketDataProvider();

/** Latest quote, cached 60 s. */
export async function getQuote(ticker: string): Promise<Quote | null> {
  return withCache(`quote:${ticker.toUpperCase()}`, 60, () =>
    provider.getQuote(ticker.toUpperCase()),
  );
}

/**
 * Batch-fetch quotes for many tickers.
 * Each quote is cached individually for 60 s; only cache misses hit the provider.
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  // Parallelise individual cached fetches so cache hits are fast.
  const entries = await Promise.all(
    tickers.map(async (t) => [t.toUpperCase(), await getQuote(t)] as const),
  );
  const map = new Map<string, Quote>();
  for (const [ticker, quote] of entries) {
    if (quote) map.set(ticker, quote);
  }
  return map;
}

/**
 * Daily OHLCV bars (chronological), cached 1 h.
 * @param days  How many calendar days of history (default 90)
 */
export async function getPriceHistory(
  ticker: string,
  days = 90,
): Promise<HistoricalBar[]> {
  const upper = ticker.toUpperCase();
  const to    = new Date();
  const from  = new Date();
  from.setDate(from.getDate() - days);

  return withCache(`price_history:${upper}:${days}d`, 3600, () =>
    provider.getPriceHistory(upper, from, to),
  );
}

// ─── Legacy synchronous API (kept for portfolio.ts compatibility) ─────────────
// These resolve from the same in-memory PRICES map used by MockMarketDataProvider,
// so they remain synchronous and zero-latency for non-async call sites.
// When you switch to a real provider, update portfolio.ts to call getQuote() directly.

const PRICES: Record<string, { price: number; previousClose: number }> = {
  NVDA:  { price: 891.25, previousClose: 872.37 },
  META:  { price: 605.30, previousClose: 598.59 },
  SPY:   { price: 542.18, previousClose: 540.66 },
  MSFT:  { price: 388.95, previousClose: 390.20 },
  AMZN:  { price: 212.75, previousClose: 214.18 },
  AAPL:  { price: 201.35, previousClose: 199.60 },
  JPM:   { price: 228.90, previousClose: 228.56 },
  GOOGL: { price: 183.40, previousClose: 182.58 },
  TSLA:  { price: 251.00, previousClose: 248.50 },
  GOOG:  { price: 182.80, previousClose: 182.00 },
  BRK_B: { price: 515.00, previousClose: 513.00 },
  V:     { price: 312.50, previousClose: 310.00 },
  MA:    { price: 530.00, previousClose: 528.00 },
  UNH:   { price: 510.00, previousClose: 512.00 },
  XOM:   { price: 118.00, previousClose: 117.50 },
  JNJ:   { price: 157.00, previousClose: 156.50 },
  WMT:   { price:  95.00, previousClose:  94.50 },
  QQQ:   { price: 468.50, previousClose: 467.00 },
  GLD:   { price: 225.00, previousClose: 224.50 },
  BTC:   { price: 83_500, previousClose: 82_000  },
};

export const SECURITY_NAMES: Record<string, string> = {
  NVDA:  "NVIDIA Corp.",
  META:  "Meta Platforms",
  SPY:   "SPDR S&P 500 ETF",
  MSFT:  "Microsoft Corp.",
  AMZN:  "Amazon.com",
  AAPL:  "Apple Inc.",
  JPM:   "JPMorgan Chase",
  GOOGL: "Alphabet Inc. (Class A)",
  GOOG:  "Alphabet Inc. (Class C)",
  TSLA:  "Tesla Inc.",
  BRK_B: "Berkshire Hathaway B",
  V:     "Visa Inc.",
  MA:    "Mastercard Inc.",
  UNH:   "UnitedHealth Group",
  XOM:   "Exxon Mobil Corp.",
  JNJ:   "Johnson & Johnson",
  WMT:   "Walmart Inc.",
  QQQ:   "Invesco QQQ Trust",
  GLD:   "SPDR Gold Shares",
  BTC:   "Bitcoin",
};

/** @deprecated Prefer the async `getQuote()`. */
export function getPrice(ticker: string): PriceData | null {
  const data = PRICES[ticker.toUpperCase()];
  if (!data) return null;
  const change = data.price - data.previousClose;
  return { ...data, change, changePct: (change / data.previousClose) * 100 };
}

export function isKnownTicker(ticker: string): boolean {
  return ticker.toUpperCase() in PRICES;
}
