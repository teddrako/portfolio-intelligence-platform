import { index, pgTable, text, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { securities } from "./securities";

/**
 * Persisted DCF valuation results per security + assumption set.
 * keyed by ticker + assumption hash so repeated identical requests
 * return the cached result instantly.
 */
export const dcfValuations = pgTable(
  "dcf_valuations",
  {
    id:             text("id").primaryKey(),
    securityId:     text("security_id").notNull().references(() => securities.id, { onDelete: "cascade" }),
    ticker:         text("ticker").notNull(),

    // Inputs
    wacc:           numeric("wacc",           { precision: 10, scale: 6 }).notNull(),
    terminalGrowth: numeric("terminal_growth", { precision: 10, scale: 6 }).notNull(),
    projectionYears: text("projection_years").notNull().default("5"),  // stored as text; parse as int
    fcffGrowthRate: numeric("fcff_growth_rate", { precision: 10, scale: 6 }).notNull(),

    // Outputs
    intrinsicValue: numeric("intrinsic_value", { precision: 20, scale: 4 }).notNull(),
    currentPrice:   numeric("current_price",   { precision: 20, scale: 4 }),
    upDownside:     numeric("up_downside",      { precision: 10, scale: 4 }), // % upside (+) or downside (-)
    enterpriseValue: numeric("enterprise_value", { precision: 20, scale: 4 }),
    equityValue:    numeric("equity_value",     { precision: 20, scale: 4 }),

    // Snapshot of FCFF projection (JSON array)
    projectedFcff:  text("projected_fcff"),  // JSON: Array<{year, fcff, pv}>

    // Cache fingerprint — SHA-1 of ticker + inputs
    assumptionHash: text("assumption_hash").notNull(),

    computedAt:    timestamp("computed_at",  { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("dcf_ticker_hash_uidx").on(t.ticker, t.assumptionHash),
    index("dcf_security_idx").on(t.securityId),
    index("dcf_ticker_idx").on(t.ticker),
  ],
);

export type DcfValuation    = typeof dcfValuations.$inferSelect;
export type NewDcfValuation = typeof dcfValuations.$inferInsert;
