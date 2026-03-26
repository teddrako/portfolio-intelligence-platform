import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { portfolios } from "./portfolios";

export const reportTypes = [
  "daily_close",
  "morning_brief",
  "custom",
  "security_analysis",
  "risk_preview",
  "portfolio_summary",
] as const;
export type ReportType = (typeof reportTypes)[number];

export const reportStatuses = ["pending", "completed", "failed"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export const aiReports = pgTable(
  "ai_reports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // null for reports that span the whole account rather than a single portfolio
    portfolioId: text("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
    type: text("type").$type<ReportType>().notNull(),
    title: text("title").notNull(),
    // The user's prompt for custom reports; null for scheduled reports
    prompt: text("prompt"),
    content: text("content").notNull().default(""),
    model: text("model").notNull(),
    tokensUsed: integer("tokens_used"),
    status: text("status").$type<ReportStatus>().notNull().default("pending"),
    // Arbitrary JSON for structured data (tickers mentioned, key stats, etc.)
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_reports_user_id_idx").on(t.userId),
    index("ai_reports_portfolio_id_idx").on(t.portfolioId),
    index("ai_reports_type_idx").on(t.type),
    index("ai_reports_created_at_idx").on(t.createdAt),
  ],
);

export type AiReport = typeof aiReports.$inferSelect;
export type NewAiReport = typeof aiReports.$inferInsert;
