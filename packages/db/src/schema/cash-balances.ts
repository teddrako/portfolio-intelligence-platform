import { numeric, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { portfolios } from "./portfolios";

// One row per (portfolio, currency) pair. Updated on every cash transaction.
export const cashBalances = pgTable(
  "cash_balances",
  {
    id: text("id").primaryKey(),
    portfolioId: text("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("USD"),
    balance: numeric("balance", { precision: 20, scale: 8 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("cash_balances_portfolio_currency_uniq").on(t.portfolioId, t.currency)],
);

export type CashBalance = typeof cashBalances.$inferSelect;
export type NewCashBalance = typeof cashBalances.$inferInsert;
