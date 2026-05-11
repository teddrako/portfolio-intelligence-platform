/**
 * NewsArticleDTO — the shape the frontend receives for any news item.
 *
 * Provider-agnostic: the router normalises raw NewsItem (from any vendor)
 * into this type before the data crosses the tRPC boundary.
 *
 * Serialisation-safe: publishedAt is an ISO-8601 string, never a Date.
 */

import type { NewsItem } from "../providers/types";
import type { LLMScore } from "../services/newsRelevance";

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
  /** 0–100; heuristic by default, LLM-scored for forHoldingsWithScores */
  relevanceScore:   number;
  /** Net portfolio impact — only present when LLM-scored */
  portfolioImpact?: "positive" | "negative" | "neutral";
  /** Short LLM-generated explanation (≤ 15 words) — only present when LLM-scored */
  llmReason?:       string;
}

export function toNewsArticleDTO(item: NewsItem, score?: LLMScore): NewsArticleDTO {
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
    relevanceScore:   score?.relevanceScore  ?? item.relevanceScore,
    portfolioImpact:  score?.portfolioImpact,
    llmReason:        score?.reason || undefined,
  };
}
