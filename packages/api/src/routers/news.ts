import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getLatestNews, getNewsByTicker, getNewsByCategory, getNewsForTickers } from "../services/news";
import { getDefaultPortfolio, getHoldings } from "../services/portfolio";
import { toNewsArticleDTO } from "../dto/news";

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

      return items.map(toNewsArticleDTO);
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
      return items.map(toNewsArticleDTO);
    }),

  /** News for a specific ticker. Cached 60 s. */
  byTicker: publicProcedure
    .input(z.object({ ticker: z.string().toUpperCase() }))
    .query(async ({ input }) => {
      const items = await getNewsByTicker(input.ticker, 20);
      return items.map(toNewsArticleDTO);
    }),

  /** News by category. */
  byCategory: publicProcedure
    .input(z.object({ category: NewsCategorySchema, limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const items = await getNewsByCategory(input.category, input.limit);
      return items.map(toNewsArticleDTO);
    }),
});
