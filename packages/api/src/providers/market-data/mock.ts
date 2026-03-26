/**
 * MockMarketDataProvider
 *
 * Uses hard-coded current quotes + a deterministic seeded random-walk for
 * price history. No API key required. Swap by changing the active provider
 * in packages/api/src/providers/market-data/index.ts.
 *
 * TO REPLACE: implement IMarketDataProvider for your real vendor and export
 * it from index.ts when the relevant env var is set.
 */

import type { IMarketDataProvider } from "./interface";
import type { Quote, HistoricalBar } from "../types";

// ─── Snapshot prices (as of 2026-03-26) ──────────────────────────────────────
// TODO: replace with live API calls (Polygon.io, Alpaca, Yahoo Finance, etc.)

const QUOTES: Record<string, { price: number; previousClose: number; dayHigh: number; dayLow: number; volume: number; marketCap?: number }> = {
  NVDA:  { price: 891.25, previousClose: 872.37, dayHigh: 897.40, dayLow: 866.20, volume: 42_300_000, marketCap: 2_190_000_000_000 },
  META:  { price: 605.30, previousClose: 598.59, dayHigh: 609.10, dayLow: 597.80, volume: 18_700_000, marketCap: 1_540_000_000_000 },
  SPY:   { price: 542.18, previousClose: 540.66, dayHigh: 543.90, dayLow: 539.50, volume: 68_000_000 },
  MSFT:  { price: 388.95, previousClose: 390.20, dayHigh: 392.00, dayLow: 387.10, volume: 22_100_000, marketCap: 2_890_000_000_000 },
  AMZN:  { price: 212.75, previousClose: 214.18, dayHigh: 215.00, dayLow: 210.90, volume: 35_600_000, marketCap: 2_230_000_000_000 },
  AAPL:  { price: 201.35, previousClose: 199.60, dayHigh: 202.80, dayLow: 199.00, volume: 55_000_000, marketCap: 3_080_000_000_000 },
  JPM:   { price: 228.90, previousClose: 228.56, dayHigh: 230.50, dayLow: 227.40, volume: 10_200_000, marketCap:  661_000_000_000 },
  GOOGL: { price: 183.40, previousClose: 182.58, dayHigh: 184.70, dayLow: 182.00, volume: 24_800_000, marketCap: 2_270_000_000_000 },
  TSLA:  { price: 251.00, previousClose: 248.50, dayHigh: 254.00, dayLow: 247.80, volume: 98_000_000, marketCap:  801_000_000_000 },
  GOOG:  { price: 182.80, previousClose: 182.00, dayHigh: 184.10, dayLow: 181.50, volume: 16_400_000 },
  BRK_B: { price: 515.00, previousClose: 513.00, dayHigh: 516.80, dayLow: 512.30, volume:  4_100_000 },
  V:     { price: 312.50, previousClose: 310.00, dayHigh: 313.90, dayLow: 309.60, volume: 7_600_000, marketCap: 643_000_000_000 },
  MA:    { price: 530.00, previousClose: 528.00, dayHigh: 532.50, dayLow: 527.00, volume: 5_800_000, marketCap: 498_000_000_000 },
  UNH:   { price: 510.00, previousClose: 512.00, dayHigh: 513.00, dayLow: 508.00, volume: 4_200_000, marketCap: 484_000_000_000 },
  XOM:   { price: 118.00, previousClose: 117.50, dayHigh: 118.90, dayLow: 117.10, volume: 16_900_000, marketCap: 473_000_000_000 },
  JNJ:   { price: 157.00, previousClose: 156.50, dayHigh: 157.80, dayLow: 156.00, volume: 8_400_000, marketCap: 376_000_000_000 },
  WMT:   { price:  95.00, previousClose:  94.50, dayHigh:  95.60, dayLow:  94.30, volume: 14_700_000, marketCap: 761_000_000_000 },
  QQQ:   { price: 468.50, previousClose: 467.00, dayHigh: 470.10, dayLow: 466.00, volume: 42_000_000 },
  GLD:   { price: 225.00, previousClose: 224.50, dayHigh: 226.00, dayLow: 224.00, volume: 9_600_000 },
  BTC:   { price: 83_500, previousClose: 82_000, dayHigh: 84_200, dayLow: 81_500, volume: 28_000, marketCap: 1_650_000_000_000 },
};

// ─── Deterministic price history generator ────────────────────────────────────

/** Mulberry32 PRNG — fast, deterministic, good quality for visual data. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function tickerSeed(ticker: string): number {
  return ticker.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
}

function generateHistory(
  ticker: string,
  currentPrice: number,
  previousClose: number,
  from: Date,
  to: Date,
): HistoricalBar[] {
  const rand = mulberry32(tickerSeed(ticker));

  // Rough annualised vol per asset class
  const dailyVol = ticker === "BTC" ? 0.035 : ticker === "SPY" || ticker === "QQQ" ? 0.01 : 0.018;

  // Count calendar days in range
  const msPerDay = 86_400_000;
  const totalDays = Math.ceil((to.getTime() - from.getTime()) / msPerDay) + 1;

  // Generate daily log-returns
  const logReturns: number[] = [];
  for (let i = 0; i < totalDays; i++) {
    // Box-Muller normal sample
    const u1 = Math.max(1e-10, rand());
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    logReturns.push(z * dailyVol - dailyVol * dailyVol * 0.5); // drift-adjusted
  }

  // Normalise so the series ends at previousClose
  const totalReturn = logReturns.reduce((s, r) => s + r, 0);
  const targetLog = Math.log(previousClose) - Math.log(currentPrice / Math.exp(totalReturn));
  const adjust = (targetLog - totalReturn) / totalDays;
  const adjustedReturns = logReturns.map((r) => r + adjust);

  // Build bars forward in time
  const bars: HistoricalBar[] = [];
  let price = currentPrice / Math.exp(adjustedReturns.reduce((s, r) => s + r, 0));

  for (let i = 0; i < totalDays; i++) {
    const day = new Date(from.getTime() + i * msPerDay);
    if (day > to) break;
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    const ret = Math.exp(adjustedReturns[i] ?? 0);
    const open = price;
    const close = price * ret;
    const high = Math.max(open, close) * (1 + rand() * 0.008);
    const low = Math.min(open, close) * (1 - rand() * 0.008);

    bars.push({
      date:     day.toISOString().slice(0, 10),
      open:     Math.round(open  * 100) / 100,
      high:     Math.round(high  * 100) / 100,
      low:      Math.round(low   * 100) / 100,
      close:    Math.round(close * 100) / 100,
      adjClose: Math.round(close * 100) / 100,
      volume:   Math.floor(500_000 + rand() * 50_000_000),
    });
    price = close;
  }

  // Pin the last bar's close to previousClose for consistency with the quote
  const last = bars.at(-1);
  if (last) {
    last.close    = previousClose;
    last.adjClose = previousClose;
  }

  return bars;
}

// ─── Provider implementation ──────────────────────────────────────────────────

export class MockMarketDataProvider implements IMarketDataProvider {
  readonly name = "Mock (no API key required)";

  async getQuote(ticker: string): Promise<Quote | null> {
    const data = QUOTES[ticker.toUpperCase()];
    if (!data) return null;
    const change = data.price - data.previousClose;
    return {
      ticker: ticker.toUpperCase(),
      price:         data.price,
      previousClose: data.previousClose,
      change,
      changePct: (change / data.previousClose) * 100,
      dayHigh:   data.dayHigh,
      dayLow:    data.dayLow,
      volume:    data.volume,
      marketCap: data.marketCap,
      timestamp: new Date(),
    };
  }

  async getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
    const map = new Map<string, Quote>();
    for (const ticker of tickers) {
      const q = await this.getQuote(ticker);
      if (q) map.set(ticker.toUpperCase(), q);
    }
    return map;
  }

  async getPriceHistory(ticker: string, from: Date, to: Date): Promise<HistoricalBar[]> {
    const upper = ticker.toUpperCase();
    const data = QUOTES[upper];
    if (!data) return [];
    return generateHistory(upper, data.price, data.previousClose, from, to);
  }
}
