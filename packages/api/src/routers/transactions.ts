import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { db } from "@pip/db/db";
import { posthog } from "../lib/posthog";
import {
  transactions,
  positions,
  cashBalances,
  securities,
  portfolios,
} from "@pip/db/schema";
import { isKnownTicker, SECURITY_NAMES } from "../services/prices";
import { getRecentTransactions } from "../services/portfolio";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Verify portfolio belongs to user; throw NOT_FOUND otherwise. */
async function assertPortfolioOwner(portfolioId: string, userId: string) {
  const rows = await db
    .select({ id: portfolios.id, currency: portfolios.currency })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  const p = rows[0];
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Portfolio not found." });
  return p;
}

/** Ensure a security record exists; creates a minimal stub for known tickers. */
async function ensureSecurity(ticker: string): Promise<string> {
  const t = ticker.toUpperCase();
  const existing = await db
    .select({ id: securities.id })
    .from(securities)
    .where(eq(securities.ticker, t))
    .limit(1);
  if (existing[0]) return existing[0].id;

  if (!isKnownTicker(t)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown ticker: ${t}. Add it first.` });
  }

  const id = `sec_${t.toLowerCase()}`;
  await db.insert(securities).values({
    id,
    ticker: t,
    name: SECURITY_NAMES[t] ?? t,
    assetClass: "equity",
    currency: "USD",
  });
  return id;
}

/** Upsert the cash balance (delta can be positive or negative). */
async function adjustCash(portfolioId: string, currency: string, delta: number) {
  const existing = await db
    .select({ id: cashBalances.id, balance: cashBalances.balance })
    .from(cashBalances)
    .where(and(eq(cashBalances.portfolioId, portfolioId), eq(cashBalances.currency, currency)))
    .limit(1);

  if (existing[0]) {
    const newBalance = (Number(existing[0].balance) + delta).toFixed(8);
    await db
      .update(cashBalances)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(cashBalances.id, existing[0].id));
  } else {
    await db.insert(cashBalances).values({
      id: newId("cash"),
      portfolioId,
      currency,
      balance: delta.toFixed(8),
    });
  }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const BuyInput = z.object({
  portfolioId: z.string(),
  ticker: z.string().min(1).max(10),
  shares: z.number().positive(),
  price: z.number().positive(),
  date: z.string().regex(dateRegex, "Use YYYY-MM-DD format"),
  fees: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  adjustCash: z.boolean().default(true),
});

const SellInput = z.object({
  portfolioId: z.string(),
  ticker: z.string().min(1).max(10),
  shares: z.number().positive(),
  price: z.number().positive(),
  date: z.string().regex(dateRegex, "Use YYYY-MM-DD format"),
  fees: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  adjustCash: z.boolean().default(true),
});

const DepositInput = z.object({
  portfolioId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  date: z.string().regex(dateRegex, "Use YYYY-MM-DD format"),
  notes: z.string().max(500).optional(),
  type: z.enum(["deposit", "withdrawal"]).default("deposit"),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const transactionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      portfolioId: z.string(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      await assertPortfolioOwner(input.portfolioId, ctx.userId);
      return getRecentTransactions(input.portfolioId, input.limit);
    }),

  buy: protectedProcedure.input(BuyInput).mutation(async ({ ctx, input }) => {
    const portfolio = await assertPortfolioOwner(input.portfolioId, ctx.userId);
    const securityId = await ensureSecurity(input.ticker);
    const ticker = input.ticker.toUpperCase();

    // Find or create open position
    const existingPos = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.portfolioId, input.portfolioId),
          eq(positions.securityId, securityId),
          isNull(positions.closedAt),
        ),
      )
      .limit(1);

    const amount = input.shares * input.price;

    if (existingPos[0]) {
      const pos = existingPos[0];
      const oldShares = Number(pos.shares);
      const oldCost = Number(pos.avgCostBasis);
      const newShares = oldShares + input.shares;
      const newAvgCost = (oldShares * oldCost + input.shares * input.price) / newShares;

      await db
        .update(positions)
        .set({
          shares: newShares.toFixed(8),
          avgCostBasis: newAvgCost.toFixed(8),
          updatedAt: new Date(),
        })
        .where(eq(positions.id, pos.id));

      const txnId = newId("txn");
      await db.insert(transactions).values({
        id: txnId,
        portfolioId: input.portfolioId,
        positionId: pos.id,
        securityId,
        type: "buy",
        date: input.date,
        shares: input.shares.toFixed(8),
        pricePerShare: input.price.toFixed(8),
        amount: amount.toFixed(8),
        fees: input.fees.toFixed(8),
        currency: portfolio.currency,
        notes: input.notes ?? null,
        source: "manual",
      });

      if (input.adjustCash) {
        await adjustCash(input.portfolioId, portfolio.currency, -(amount + input.fees));
      }

      posthog.capture({
        distinctId: ctx.userId,
        event: "transaction_bought",
        properties: { ticker, shares: input.shares, price: input.price, amount, fees: input.fees, portfolioId: input.portfolioId },
      });

      return { positionId: pos.id, transactionId: txnId };
    } else {
      const posId = newId("pos");
      await db.insert(positions).values({
        id: posId,
        portfolioId: input.portfolioId,
        securityId,
        shares: input.shares.toFixed(8),
        avgCostBasis: input.price.toFixed(8),
        openedAt: new Date(input.date),
      });

      const txnId = newId("txn");
      await db.insert(transactions).values({
        id: txnId,
        portfolioId: input.portfolioId,
        positionId: posId,
        securityId,
        type: "buy",
        date: input.date,
        shares: input.shares.toFixed(8),
        pricePerShare: input.price.toFixed(8),
        amount: amount.toFixed(8),
        fees: input.fees.toFixed(8),
        currency: portfolio.currency,
        notes: input.notes ?? null,
        source: "manual",
      });

      if (input.adjustCash) {
        await adjustCash(input.portfolioId, portfolio.currency, -(amount + input.fees));
      }

      posthog.capture({
        distinctId: ctx.userId,
        event: "transaction_bought",
        properties: { ticker, shares: input.shares, price: input.price, amount, fees: input.fees, portfolioId: input.portfolioId },
      });

      return { positionId: posId, transactionId: txnId };
    }
  }),

  sell: protectedProcedure.input(SellInput).mutation(async ({ ctx, input }) => {
    const portfolio = await assertPortfolioOwner(input.portfolioId, ctx.userId);
    const securityId = await ensureSecurity(input.ticker);

    const existingPos = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.portfolioId, input.portfolioId),
          eq(positions.securityId, securityId),
          isNull(positions.closedAt),
        ),
      )
      .limit(1);

    const pos = existingPos[0];
    if (!pos) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `No open position for ${input.ticker}.` });
    }

    const currentShares = Number(pos.shares);
    if (input.shares > currentShares + 0.000001) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot sell ${input.shares} shares — only ${currentShares} held.`,
      });
    }

    const remainingShares = currentShares - input.shares;
    const amount = input.shares * input.price;

    if (remainingShares < 0.000001) {
      // Close position
      await db
        .update(positions)
        .set({ shares: "0", closedAt: new Date(input.date), updatedAt: new Date() })
        .where(eq(positions.id, pos.id));
    } else {
      await db
        .update(positions)
        .set({ shares: remainingShares.toFixed(8), updatedAt: new Date() })
        .where(eq(positions.id, pos.id));
    }

    const txnId = newId("txn");
    await db.insert(transactions).values({
      id: txnId,
      portfolioId: input.portfolioId,
      positionId: pos.id,
      securityId,
      type: "sell",
      date: input.date,
      shares: input.shares.toFixed(8),
      pricePerShare: input.price.toFixed(8),
      amount: amount.toFixed(8),
      fees: input.fees.toFixed(8),
      currency: portfolio.currency,
      notes: input.notes ?? null,
      source: "manual",
    });

    if (input.adjustCash) {
      await adjustCash(input.portfolioId, portfolio.currency, amount - input.fees);
    }

    posthog.capture({
      distinctId: ctx.userId,
      event: "transaction_sold",
      properties: { ticker: input.ticker.toUpperCase(), shares: input.shares, price: input.price, amount, fees: input.fees, portfolioId: input.portfolioId },
    });

    return { positionId: pos.id, transactionId: txnId };
  }),

  deposit: protectedProcedure.input(DepositInput).mutation(async ({ ctx, input }) => {
    const portfolio = await assertPortfolioOwner(input.portfolioId, ctx.userId);
    const currency = input.currency ?? portfolio.currency;
    const isWithdrawal = input.type === "withdrawal";
    const delta = isWithdrawal ? -input.amount : input.amount;

    if (isWithdrawal) {
      const current = await db
        .select({ balance: cashBalances.balance })
        .from(cashBalances)
        .where(and(eq(cashBalances.portfolioId, input.portfolioId), eq(cashBalances.currency, currency)))
        .limit(1);
      const currentBalance = current[0] ? Number(current[0].balance) : 0;
      if (input.amount > currentBalance + 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient cash. Balance: $${currentBalance.toFixed(2)}`,
        });
      }
    }

    const txnId = newId("txn");
    await db.insert(transactions).values({
      id: txnId,
      portfolioId: input.portfolioId,
      type: input.type,
      date: input.date,
      amount: input.amount.toFixed(8),
      fees: "0",
      currency,
      notes: input.notes ?? null,
      source: "manual",
    });

    await adjustCash(input.portfolioId, currency, delta);

    posthog.capture({
      distinctId: ctx.userId,
      event: isWithdrawal ? "cash_withdrawn" : "cash_deposited",
      properties: { amount: input.amount, currency, portfolioId: input.portfolioId },
    });

    return { transactionId: txnId };
  }),
});
