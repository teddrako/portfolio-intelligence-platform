import { pgTable, text, numeric, bigint, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { securities } from "./securities";

/**
 * Daily EOD price bars per security.
 * Populated by the ingest-prices job.
 * Unique constraint on (security_id, date) — safe to upsert.
 */
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id:         text("id").primaryKey(),
    securityId: text("security_id").notNull().references(() => securities.id, { onDelete: "cascade" }),
    date:       text("date").notNull(),           // YYYY-MM-DD
    open:       numeric("open",      { precision: 20, scale: 8 }),
    high:       numeric("high",      { precision: 20, scale: 8 }),
    low:        numeric("low",       { precision: 20, scale: 8 }),
    close:      numeric("close",     { precision: 20, scale: 8 }).notNull(),
    adjClose:   numeric("adj_close", { precision: 20, scale: 8 }),
    volume:     bigint("volume", { mode: "number" }),
    source:     text("source").default("mock"),
    createdAt:  timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("price_snapshot_security_date_uidx").on(t.securityId, t.date),
    index("price_snapshot_security_idx").on(t.securityId),
    index("price_snapshot_date_idx").on(t.date),
  ],
);

export type PriceSnapshot    = typeof priceSnapshots.$inferSelect;
export type NewPriceSnapshot = typeof priceSnapshots.$inferInsert;
