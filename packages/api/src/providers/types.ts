/**
 * Canonical internal data models shared across all providers.
 * All provider implementations must map their vendor-specific responses
 * to these types so the rest of the app stays vendor-agnostic.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type NewsCategory =
  | "company"
  | "sector"
  | "macro"
  | "policy"
  | "geopolitical"
  | "commodities"
  | "rates"
  | "fx"
  | "earnings";

export type Sentiment  = "positive" | "negative" | "neutral";
export type Importance = "low" | "medium" | "high";
export type EarningsTime = "before_market" | "after_market" | "during_market" | "unknown";

// ─── Market Data ──────────────────────────────────────────────────────────────

/** Latest intraday or EOD quote for a single security. */
export interface Quote {
  ticker:        string;
  price:         number;
  previousClose: number;
  change:        number;   // price - previousClose
  changePct:     number;   // (change / previousClose) * 100
  dayHigh:       number;
  dayLow:        number;
  volume:        number;
  marketCap?:    number;
  timestamp:     Date;
}

/** One OHLCV bar in a price history series. */
export interface HistoricalBar {
  date:     string;  // YYYY-MM-DD
  open:     number;
  high:     number;
  low:      number;
  close:    number;
  adjClose: number;
  volume:   number;
}

// ─── News ─────────────────────────────────────────────────────────────────────

export interface NewsItem {
  externalId?:     string;
  title:           string;
  summary:         string;
  source:          string;
  url:             string;
  publishedAt:     Date;
  affectedTickers: string[];
  ticker?:         string;     // primary ticker (if single-company story)
  category:        NewsCategory;
  sentiment:       Sentiment;
  importance:      Importance;
  relevanceScore:  number;     // 0-100
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface MacroEvent {
  externalId?:  string;
  title:        string;
  date:         string;  // YYYY-MM-DD
  time?:        string;  // HH:MM ET
  country:      string;
  category:     string;
  importance:   Importance;
  forecast?:    string;
  previous?:    string;
  actual?:      string;
  description?: string;
}

export interface EarningsEvent {
  ticker:           string;
  securityName?:    string;
  date:             string;   // YYYY-MM-DD
  time:             EarningsTime;
  epsEstimate?:     number;
  epsActual?:       number;
  revenueEstimate?: number;
  revenueActual?:   number;
  surprisePct?:     number;
  isConfirmed:      boolean;
}
