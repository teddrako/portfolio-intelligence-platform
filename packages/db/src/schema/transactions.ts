import { index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { portfolios } from "./portfolios";
import { positions } from "./holdings";
import { securities } from "./securities";

export const transactionTypes = [
  "buy",
  "sell",
  "dividend",
  "interest",
  "split",
  "deposit",
  "withdrawal",
  "fee",
  "transfer",
] as const;
export type TransactionType = (typeof transactionTypes)[number];

export const transactionSources = ["manual", "import", "broker"] as const;
export type TransactionSource = (typeof transactionSources)[number];

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    portfolioId: text("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    // nullable — cash deposits/withdrawals don't belong to a position
    positionId: text("position_id").references(() => positions.id, { onDelete: "set null" }),
    securityId: text("security_id").references(() => securities.id),
    type: text("type").$type<TransactionType>().notNull(),
    // Trade date (stored as text in YYYY-MM-DD to avoid timezone edge cases on pure dates)
    date: text("date").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    // null for pure cash transactions (deposits, withdrawals, fees)
    shares: numeric("shares", { precision: 20, scale: 8 }),
    pricePerShare: numeric("price_per_share", { precision: 20, scale: 8 }),
    // total amount — positive = money in, negative = money out
    amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
    fees: numeric("fees", { precision: 20, scale: 8 }).notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    notes: text("notes"),
    source: text("source").$type<TransactionSource>().notNull().default("manual"),
    // External broker/import ID for deduplication
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("transactions_portfolio_id_idx").on(t.portfolioId),
    index("transactions_position_id_idx").on(t.positionId),
    index("transactions_security_id_idx").on(t.securityId),
    index("transactions_date_idx").on(t.date),
    index("transactions_type_idx").on(t.type),
    index("transactions_external_id_idx").on(t.externalId),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
