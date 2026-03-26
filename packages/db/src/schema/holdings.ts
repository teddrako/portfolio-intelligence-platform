import { index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { portfolios } from "./portfolios";
import { securities } from "./securities";

// "Positions" is the preferred term — a position is an open or closed holding
// of a security within a portfolio.
export const positions = pgTable(
  "positions",
  {
    id: text("id").primaryKey(),
    portfolioId: text("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    securityId: text("security_id")
      .notNull()
      .references(() => securities.id),
    // numeric(20, 8): supports up to 12 integer digits + 8 decimal places (handles crypto)
    shares: numeric("shares", { precision: 20, scale: 8 }).notNull(),
    avgCostBasis: numeric("avg_cost_basis", { precision: 20, scale: 8 }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("positions_portfolio_id_idx").on(t.portfolioId),
    index("positions_security_id_idx").on(t.securityId),
    index("positions_closed_at_idx").on(t.closedAt),
  ],
);

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
