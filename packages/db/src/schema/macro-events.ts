import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Macro economic calendar events (CPI, NFP, FOMC, GDP, etc.).
 * Populated by the ingest-calendar job.
 */
export const macroEvents = pgTable(
  "macro_events",
  {
    id:          text("id").primaryKey(),
    title:       text("title").notNull(),
    date:        text("date").notNull(),     // YYYY-MM-DD
    time:        text("time"),               // HH:MM ET (nullable — TBD)
    country:     text("country").default("US").notNull(),
    /** inflation | employment | rates | gdp | trade | housing | consumer | manufacturing */
    category:    text("category").notNull(),
    importance:  text("importance", { enum: ["low", "medium", "high"] }).notNull(),
    forecast:    text("forecast"),
    previous:    text("previous"),
    actual:      text("actual"),
    description: text("description"),
    source:      text("source").default("mock"),
    createdAt:   timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("macro_event_date_idx").on(t.date),
    index("macro_event_country_idx").on(t.country),
    index("macro_event_importance_idx").on(t.importance),
  ],
);

export type MacroEvent    = typeof macroEvents.$inferSelect;
export type NewMacroEvent = typeof macroEvents.$inferInsert;
