import { index, integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { securities } from "./securities";

/**
 * Annual income statement + cash flow data per security.
 * Populated by the FMP fundamentals service; cached in DB to avoid
 * burning free-tier API quota on every valuation request.
 */
export const financialStatements = pgTable(
  "financial_statements",
  {
    id:              text("id").primaryKey(),
    securityId:      text("security_id").references(() => securities.id, { onDelete: "cascade" }),
    ticker:          text("ticker").notNull(),
    fiscalYear:      integer("fiscal_year").notNull(),         // e.g. 2023
    period:          text("period").notNull().default("FY"),   // FY | Q1 | Q2 | Q3 | Q4

    // Income statement
    revenue:         numeric("revenue",          { precision: 20, scale: 2 }),
    grossProfit:     numeric("gross_profit",     { precision: 20, scale: 2 }),
    operatingIncome: numeric("operating_income", { precision: 20, scale: 2 }),
    netIncome:       numeric("net_income",       { precision: 20, scale: 2 }),
    ebit:            numeric("ebit",             { precision: 20, scale: 2 }),
    ebitda:          numeric("ebitda",           { precision: 20, scale: 2 }),
    eps:             numeric("eps",              { precision: 20, scale: 6 }),
    sharesOutstanding: numeric("shares_outstanding", { precision: 20, scale: 2 }),

    // Cash flow statement
    operatingCashFlow: numeric("operating_cash_flow", { precision: 20, scale: 2 }),
    capitalExpenditures: numeric("capital_expenditures", { precision: 20, scale: 2 }),
    freeCashFlow:      numeric("free_cash_flow",      { precision: 20, scale: 2 }),
    depreciation:      numeric("depreciation",        { precision: 20, scale: 2 }),

    // Balance sheet
    totalDebt:         numeric("total_debt",           { precision: 20, scale: 2 }),
    cashAndEquivalents: numeric("cash_and_equivalents", { precision: 20, scale: 2 }),
    totalAssets:       numeric("total_assets",         { precision: 20, scale: 2 }),
    totalEquity:       numeric("total_equity",         { precision: 20, scale: 2 }),

    // Tax & interest (for FCFF)
    interestExpense:   numeric("interest_expense",     { precision: 20, scale: 2 }),
    taxRate:           numeric("tax_rate",             { precision: 10, scale: 6 }),

    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("fin_stmt_ticker_year_period_uidx").on(t.ticker, t.fiscalYear, t.period),
    index("fin_stmt_security_idx").on(t.securityId),
    index("fin_stmt_ticker_idx").on(t.ticker),
  ],
);

export type FinancialStatement    = typeof financialStatements.$inferSelect;
export type NewFinancialStatement = typeof financialStatements.$inferInsert;
