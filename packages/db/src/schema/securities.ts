import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const assetClasses = ["equity", "etf", "bond", "crypto", "commodity"] as const;
export type AssetClass = (typeof assetClasses)[number];

export const securities = pgTable(
  "securities",
  {
    id: text("id").primaryKey(),
    ticker: text("ticker").notNull().unique(),
    name: text("name").notNull(),
    assetClass: text("asset_class").$type<AssetClass>().notNull(),
    sector: text("sector"),
    industry: text("industry"),
    exchange: text("exchange"),
    currency: text("currency").notNull().default("USD"),
    description: text("description"),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("securities_asset_class_idx").on(t.assetClass),
    index("securities_sector_idx").on(t.sector),
  ],
);

export type Security = typeof securities.$inferSelect;
export type NewSecurity = typeof securities.$inferInsert;
