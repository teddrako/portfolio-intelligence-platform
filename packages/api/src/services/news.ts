/**
 * News service — caching layer over INewsProvider.
 *
 * All results are cached in Redis (fail-open).
 * Swap the underlying vendor via the NEWS_PROVIDER env var.
 */

import { getNewsProvider } from "../providers/news";
import { withCache } from "../lib/redis";
import type { NewsItem, NewsCategory } from "../providers/types";

export type { NewsItem, NewsCategory };

const provider = getNewsProvider();

/** Most recent headlines, cached 60 s. */
export async function getLatestNews(limit: number): Promise<NewsItem[]> {
  return withCache(`news:list:${limit}`, 60, () =>
    provider.getLatestNews(limit),
  );
}

/** Headlines for a ticker, cached 60 s. */
export async function getNewsByTicker(ticker: string, limit: number): Promise<NewsItem[]> {
  const upper = ticker.toUpperCase();
  return withCache(`news:ticker:${upper}:${limit}`, 60, () =>
    provider.getNewsByTicker(upper, limit),
  );
}

/** Headlines by category, cached 60 s. */
export async function getNewsByCategory(category: NewsCategory, limit: number): Promise<NewsItem[]> {
  return withCache(`news:category:${category}:${limit}`, 60, () =>
    provider.getNewsByCategory(category, limit),
  );
}

/**
 * News relevant to a set of tickers (union), cached 60 s.
 * Reuses the cached getLatestNews(200) response — no extra API call.
 */
export async function getNewsForTickers(tickers: string[], limit: number): Promise<NewsItem[]> {
  const upper = tickers.map((t) => t.toUpperCase()).sort();
  const key = `news:tickers:${upper.join("-")}:${limit}`;

  return withCache(key, 60, async () => {
    // Use the service-level cached call, not the raw provider — avoids a duplicate API hit
    const all = await getLatestNews(200);
    const upperSet = new Set(upper);
    return all
      .filter((n) => n.affectedTickers.some((t) => upperSet.has(t)) || (n.ticker && upperSet.has(n.ticker)))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);
  });
}
