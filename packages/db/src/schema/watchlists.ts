import { boolean, index, numeric, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { securities } from "./securities";

// ─── Watchlists ───────────────────────────────────────────────────────────────

export const watchlists = pgTable(
  "watchlists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Watchlist"),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("watchlists_user_id_idx").on(t.userId)],
);

export type Watchlist = typeof watchlists.$inferSelect;
export type NewWatchlist = typeof watchlists.$inferInsert;

// ─── Watchlist Items ──────────────────────────────────────────────────────────

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: text("id").primaryKey(),
    watchlistId: text("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    securityId: text("security_id")
      .notNull()
      .references(() => securities.id, { onDelete: "cascade" }),
    // Optional price level for alerting (not active until alerts feature ships)
    alertPrice: numeric("alert_price", { precision: 20, scale: 8 }),
    notes: text("notes"),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("watchlist_items_watchlist_security_uniq").on(t.watchlistId, t.securityId),
    index("watchlist_items_watchlist_id_idx").on(t.watchlistId),
    index("watchlist_items_security_id_idx").on(t.securityId),
  ],
);

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type NewWatchlistItem = typeof watchlistItems.$inferInsert;
