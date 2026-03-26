/**
 * NewsArticleDTO — the shape the frontend receives for any news item.
 *
 * Provider-agnostic: the router normalises raw NewsItem (from any vendor)
 * into this type before the data crosses the tRPC boundary.
 *
 * Serialisation-safe: publishedAt is an ISO-8601 string, never a Date.
 */

import type { NewsItem } from "../providers/types";

export interface NewsArticleDTO {
  title:       string;
  summary:     string;
  source:      string;
  url:         string;
  /** ISO-8601 string — safe for JSON / tRPC serialisation */
  publishedAt: string;
  /** Deduped union of primary ticker + all affected tickers */
  tickers:     string[];
  category:    string;
  sentiment:   "positive" | "negative" | "neutral";
  importance:  "low" | "medium" | "high";
}

export function toNewsArticleDTO(item: NewsItem): NewsArticleDTO {
  const seen = new Set<string>();
  if (item.ticker) seen.add(item.ticker);
  for (const t of item.affectedTickers) seen.add(t);

  return {
    title:       item.title,
    summary:     item.summary,
    source:      item.source,
    url:         item.url,
    publishedAt: item.publishedAt instanceof Date
      ? item.publishedAt.toISOString()
      : String(item.publishedAt),
    tickers:     [...seen],
    category:    item.category,
    sentiment:   item.sentiment,
    importance:  item.importance,
  };
}
