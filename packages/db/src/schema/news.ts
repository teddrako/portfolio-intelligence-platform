import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sentiments = ["positive", "negative", "neutral"] as const;
export type Sentiment = (typeof sentiments)[number];

export const importanceLevels = ["high", "medium", "low"] as const;
export type ImportanceLevel = (typeof importanceLevels)[number];

export const newsCategories = [
  "company",
  "sector",
  "macro",
  "policy",
  "geopolitical",
  "commodities",
  "rates",
  "fx",
  "earnings",
] as const;
export type NewsCategory = (typeof newsCategories)[number];

export const newsItems = pgTable(
  "news_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    summary: text("summary"),
    source: text("source").notNull(),
    url: text("url"),
    // Primary ticker this item is about (nullable for macro/sector news)
    ticker: text("ticker"),
    // Array of all tickers affected — used for relevance filtering
    affectedTickers: text("affected_tickers").array(),
    category: text("category").$type<NewsCategory>(),
    sentiment: text("sentiment").$type<Sentiment>(),
    importance: text("importance").$type<ImportanceLevel>(),
    // 0–100 relevance score relative to a user's holdings (set by ingestion worker)
    relevanceScore: integer("relevance_score"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("news_items_published_at_idx").on(t.publishedAt),
    index("news_items_ticker_idx").on(t.ticker),
    index("news_items_category_idx").on(t.category),
    index("news_items_importance_idx").on(t.importance),
  ],
);

export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
