import type { NewsItem, NewsCategory } from "../types";

/**
 * Swap vendors by implementing this interface and updating
 * packages/api/src/providers/news/index.ts.
 *
 * Real providers to plug in:
 *   - Alpaca News    → set NEWS_PROVIDER=alpaca   + ALPACA_API_KEY
 *   - Polygon.io     → set NEWS_PROVIDER=polygon  + POLYGON_API_KEY
 *   - Benzinga       → set NEWS_PROVIDER=benzinga + BENZINGA_API_KEY
 *   - NewsAPI        → set NEWS_PROVIDER=newsapi  + NEWSAPI_KEY
 */
export interface INewsProvider {
  readonly name: string;

  /** Most recent headlines across all tickers, sorted newest-first. */
  getLatestNews(limit: number): Promise<NewsItem[]>;

  /** Headlines mentioning a specific ticker, sorted newest-first. */
  getNewsByTicker(ticker: string, limit: number): Promise<NewsItem[]>;

  /** Headlines in a specific category, sorted newest-first. */
  getNewsByCategory(category: NewsCategory, limit: number): Promise<NewsItem[]>;
}
