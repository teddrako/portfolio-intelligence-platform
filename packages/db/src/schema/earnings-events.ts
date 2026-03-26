import { pgTable, text, numeric, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { securities } from "./securities";

/**
 * Upcoming and historical earnings dates per security.
 * Populated by the ingest-calendar job.
 * Unique on (ticker, date) — safe to upsert.
 */
export const earningsEvents = pgTable(
  "earnings_events",
  {
    id:               text("id").primaryKey(),
    securityId:       text("security_id").references(() => securities.id, { onDelete: "set null" }),
    ticker:           text("ticker").notNull(),
    securityName:     text("security_name"),
    date:             text("date").notNull(),   // YYYY-MM-DD
    /** before_market | after_market | during_market | unknown */
    time:             text("time", {
                        enum: ["before_market", "after_market", "during_market", "unknown"],
                      }).default("unknown"),
    epsEstimate:      numeric("eps_estimate",      { precision: 20, scale: 4 }),
    epsActual:        numeric("eps_actual",        { precision: 20, scale: 4 }),
    revenueEstimate:  numeric("revenue_estimate",  { precision: 20, scale: 2 }),
    revenueActual:    numeric("revenue_actual",    { precision: 20, scale: 2 }),
    surprisePct:      numeric("surprise_pct",      { precision: 10, scale: 2 }),
    isConfirmed:      boolean("is_confirmed").default(false),
    source:           text("source").default("mock"),
    createdAt:        timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("earnings_event_ticker_date_uidx").on(t.ticker, t.date),
    index("earnings_event_date_idx").on(t.date),
    index("earnings_event_ticker_idx").on(t.ticker),
  ],
);

export type EarningsEvent    = typeof earningsEvents.$inferSelect;
export type NewEarningsEvent = typeof earningsEvents.$inferInsert;
