import { relations } from "drizzle-orm";
import { users } from "./users";
import { accounts, sessions } from "./accounts";
import { securities } from "./securities";
import { portfolios } from "./portfolios";
import { positions } from "./holdings";
import { transactions } from "./transactions";
import { cashBalances } from "./cash-balances";
import { watchlists, watchlistItems } from "./watchlists";
import { aiReports } from "./ai-reports";
import { priceSnapshots } from "./price-snapshots";
import { earningsEvents } from "./earnings-events";

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  portfolios: many(portfolios),
  watchlists: many(watchlists),
  aiReports: many(aiReports),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const securitiesRelations = relations(securities, ({ many }) => ({
  positions: many(positions),
  transactions: many(transactions),
  watchlistItems: many(watchlistItems),
  priceSnapshots: many(priceSnapshots),
  earningsEvents: many(earningsEvents),
}));

export const priceSnapshotsRelations = relations(priceSnapshots, ({ one }) => ({
  security: one(securities, { fields: [priceSnapshots.securityId], references: [securities.id] }),
}));

export const earningsEventsRelations = relations(earningsEvents, ({ one }) => ({
  security: one(securities, { fields: [earningsEvents.securityId], references: [securities.id] }),
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  user: one(users, { fields: [portfolios.userId], references: [users.id] }),
  positions: many(positions),
  transactions: many(transactions),
  cashBalances: many(cashBalances),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  portfolio: one(portfolios, { fields: [positions.portfolioId], references: [portfolios.id] }),
  security: one(securities, { fields: [positions.securityId], references: [securities.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  portfolio: one(portfolios, { fields: [transactions.portfolioId], references: [portfolios.id] }),
  position: one(positions, { fields: [transactions.positionId], references: [positions.id] }),
  security: one(securities, { fields: [transactions.securityId], references: [securities.id] }),
}));

export const cashBalancesRelations = relations(cashBalances, ({ one }) => ({
  portfolio: one(portfolios, { fields: [cashBalances.portfolioId], references: [portfolios.id] }),
}));

export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  user: one(users, { fields: [watchlists.userId], references: [users.id] }),
  items: many(watchlistItems),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, { fields: [watchlistItems.watchlistId], references: [watchlists.id] }),
  security: one(securities, { fields: [watchlistItems.securityId], references: [securities.id] }),
}));

export const aiReportsRelations = relations(aiReports, ({ one }) => ({
  user: one(users, { fields: [aiReports.userId], references: [users.id] }),
  portfolio: one(portfolios, { fields: [aiReports.portfolioId], references: [portfolios.id] }),
}));
