/**
 * YahooMarketDataProvider
 *
 * Real-time quotes and price history via yahoo-finance2 (no API key required).
 * Enable: set MARKET_DATA_PROVIDER=yahoo
 *
 * Rate limits: Yahoo Finance is unofficial / best-effort. The library handles
 * cookie refresh automatically. For bulk intraday polling, add delay between
 * getQuote calls in the caller to avoid 429s.
 */

import YahooFinance from "yahoo-finance2";
import type { IMarketDataProvider } from "./interface";
import type { Quote, HistoricalBar } from "../types";

// Global singleton survives Next.js HMR module re-evaluation, which would
// otherwise create a new YahooFinance instance (and its process listeners)
// on every hot reload, triggering MaxListenersExceededWarning.
declare global {
  // eslint-disable-next-line no-var
  var __yahooFinance: InstanceType<typeof YahooFinance> | undefined;
  // eslint-disable-next-line no-var
  var __yahooListenersPatched: boolean | undefined;
}

if (!global.__yahooListenersPatched) {
  global.__yahooListenersPatched = true;
  // Yahoo Finance registers uncaughtException/unhandledRejection listeners;
  // raise the limit to prevent false-positive MaxListenersExceededWarnings.
  process.setMaxListeners(Math.max(process.getMaxListeners(), 25));
}

const yf =
  global.__yahooFinance ??
  (global.__yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] }));

export class YahooMarketDataProvider implements IMarketDataProvider {
  readonly name = "Yahoo Finance";

  async getQuote(ticker: string): Promise<Quote | null> {
    try {
      const q = await yf.quote(ticker.toUpperCase());
      if (!q || q.regularMarketPrice == null) return null;
      const price  = q.regularMarketPrice;
      const prev   = q.regularMarketPreviousClose ?? price;
      const change = price - prev;
      return {
        ticker:        q.symbol,
        price,
        previousClose: prev,
        change,
        changePct:     prev !== 0 ? (change / prev) * 100 : 0,
        dayHigh:       q.regularMarketDayHigh ?? price,
        dayLow:        q.regularMarketDayLow  ?? price,
        volume:        q.regularMarketVolume  ?? 0,
        marketCap:     q.marketCap            ?? undefined,
        timestamp:     new Date(),
      };
    } catch {
      return null;
    }
  }

  async getQuotes(tickers: string[]): Promise<Map<string, Quote>> {
    if (tickers.length === 0) return new Map();
    // Single batch HTTP request instead of N parallel individual requests.
    try {
      const raw = await yf.quote(tickers.map(t => t.toUpperCase()));
      const arr = Array.isArray(raw) ? raw : [raw];
      const map = new Map<string, Quote>();
      for (const q of arr) {
        if (!q || q.regularMarketPrice == null) continue;
        const price  = q.regularMarketPrice;
        const prev   = q.regularMarketPreviousClose ?? price;
        const change = price - prev;
        map.set(q.symbol, {
          ticker:        q.symbol,
          price,
          previousClose: prev,
          change,
          changePct:     prev !== 0 ? (change / prev) * 100 : 0,
          dayHigh:       q.regularMarketDayHigh ?? price,
          dayLow:        q.regularMarketDayLow  ?? price,
          volume:        q.regularMarketVolume  ?? 0,
          marketCap:     q.marketCap            ?? undefined,
          timestamp:     new Date(),
        });
      }
      return map;
    } catch {
      // Fall back to individual calls if batch fails
      const results = await Promise.allSettled(tickers.map((t) => this.getQuote(t)));
      const map = new Map<string, Quote>();
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) map.set(r.value.ticker, r.value);
      }
      return map;
    }
  }

  async getPriceHistory(ticker: string, from: Date, to: Date): Promise<HistoricalBar[]> {
    try {
      const result = await yf.chart(ticker.toUpperCase(), {
        period1:  from,
        period2:  to,
        interval: "1d",
        return:   "array",
      });
      return (result.quotes ?? [])
        .filter((q) => q.close != null)
        .map((q) => ({
          date:     q.date.toISOString().slice(0, 10),
          open:     q.open     ?? q.close!,
          high:     q.high     ?? q.close!,
          low:      q.low      ?? q.close!,
          close:    q.close!,
          adjClose: q.adjclose ?? q.close!,
          volume:   q.volume   ?? 0,
        }));
    } catch {
      return [];
    }
  }
}
