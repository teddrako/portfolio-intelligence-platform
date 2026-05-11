import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getLatestNews, getNewsByTicker, getNewsByCategory, getNewsForTickers } from "../services/news";
import { getDefaultPortfolio, getHoldings } from "../services/portfolio";
import { toNewsArticleDTO } from "../dto/news";
import { scoreArticlesForPortfolio } from "../services/newsRelevance";
import type { NewsItem } from "../services/news";

const NewsCategorySchema = z.enum([
  "company", "sector", "macro", "policy", "geopolitical",
  "commodities", "rates", "fx", "earnings",
]);

export const newsRouter = router({
  /** Latest headlines (all tickers). Cached 5 min. */
  list: publicProcedure
    .input(
      z.object({
        limit:    z.number().min(1).max(50).default(20),
        category: NewsCategorySchema.optional(),
        ticker:   z.string().toUpperCase().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const limit    = input?.limit ?? 20;
      const category = input?.category;
      const ticker   = input?.ticker;

      let items;
      if (ticker)   items = await getNewsByTicker(ticker, limit);
      else if (category) items = await getNewsByCategory(category, limit);
      else          items = await getLatestNews(limit);

      return items.map((item) => toNewsArticleDTO(item));
    }),

  /** News filtered to a user's current holdings. */
  forHoldings: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return [];
      const holdings = await getHoldings(portfolio.id);
      const tickers  = holdings.map((h) => h.ticker);
      const items    = await getNewsForTickers(tickers, input?.limit ?? 30);
      return items.map((item) => toNewsArticleDTO(item));
    }),

  /** News for a specific ticker. Cached 60 s. */
  byTicker: publicProcedure
    .input(z.object({ ticker: z.string().toUpperCase() }))
    .query(async ({ input }) => {
      const items = await getNewsByTicker(input.ticker, 20);
      return items.map((item) => toNewsArticleDTO(item));
    }),

  /** News by category. */
  byCategory: publicProcedure
    .input(z.object({ category: NewsCategorySchema, limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const items = await getNewsByCategory(input.category, input.limit);
      return items.map((item) => toNewsArticleDTO(item));
    }),

  /**
   * News for the user's holdings, enriched with LLM relevance scores.
   *
   * Fetches per-ticker headlines in parallel, deduplicates by URL, then
   * calls the configured LLM to score each article for portfolio relevance.
   * Scores are cached 5 min so the LLM is called at most once per window.
   * Falls back to heuristic scores if the LLM is unavailable.
   *
   * Returns articles sorted by relevance score descending.
   */
  forHoldingsWithScores: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(60).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 30;

      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return [];

      const holdings = await getHoldings(portfolio.id);
      if (holdings.length === 0) return [];

      const tickers = [...new Set(holdings.map((h) => h.ticker))];

      // Fetch per-ticker news in parallel (provider caches each call for 60 s)
      const perTicker = await Promise.all(
        tickers.map((t) => getNewsByTicker(t, 10).catch((): NewsItem[] => [])),
      );

      // Deduplicate by URL, keeping newest per URL
      const byUrl = new Map<string, NewsItem>();
      for (const batch of perTicker) {
        for (const item of batch) {
          const existing = byUrl.get(item.url);
          if (!existing || item.publishedAt > existing.publishedAt) {
            byUrl.set(item.url, item);
          }
        }
      }

      // Sort newest-first, then take the top N for scoring
      const articles = [...byUrl.values()]
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, limit);

      // Build holding context for the LLM prompt
      const holdingContext = holdings.map((h) => ({
        ticker:          h.ticker,
        name:            h.name,
        portfolioWeight: h.portfolioWeight,
        sector:          h.sector,
      }));

      // Score with LLM (fail-open: falls back to heuristic scores)
      const scores = await scoreArticlesForPortfolio(articles, holdingContext).catch(
        () => new Map<string, { relevanceScore: number; portfolioImpact: "neutral"; reason: "" }>(),
      );

      return articles
        .map((item) => toNewsArticleDTO(item, scores.get(item.url)))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }),
});
