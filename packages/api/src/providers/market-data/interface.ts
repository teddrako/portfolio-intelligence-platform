import type { Quote, HistoricalBar } from "../types";

/**
 * Swap vendors by implementing this interface and updating
 * packages/api/src/providers/market-data/index.ts.
 *
 * Real providers to plug in:
 *   - Polygon.io  → set MARKET_DATA_PROVIDER=polygon + POLYGON_API_KEY
 *   - Alpaca      → set MARKET_DATA_PROVIDER=alpaca  + ALPACA_API_KEY
 *   - Yahoo Finance (unofficial) → set MARKET_DATA_PROVIDER=yahoo
 */
export interface IMarketDataProvider {
  /** Human-readable name shown in logs. */
  readonly name: string;

  /** Latest quote for a single ticker. Returns null if the ticker is unknown. */
  getQuote(ticker: string): Promise<Quote | null>;

  /**
   * Batch-fetch quotes for many tickers in one call.
   * Missing or unknown tickers are absent from the returned Map.
   */
  getQuotes(tickers: string[]): Promise<Map<string, Quote>>;

  /**
   * Daily OHLCV bars in chronological order (oldest → newest).
   * from/to are inclusive calendar dates; weekends are excluded.
   */
  getPriceHistory(ticker: string, from: Date, to: Date): Promise<HistoricalBar[]>;
}
