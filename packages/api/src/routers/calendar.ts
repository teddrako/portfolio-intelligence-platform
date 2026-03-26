import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { getMacroEvents, getEarningsEvents, getEarningsForPortfolio } from "../services/calendar";
import { getDefaultPortfolio, getHoldings } from "../services/portfolio";
import { toMacroEventDTO, toEarningsEventDTO } from "../dto/calendar";

export const calendarRouter = router({
  /**
   * Macro economic events in the next N days.
   * Public — market-wide data, no auth required.
   */
  macroEvents: publicProcedure
    .input(z.object({ days: z.number().min(1).max(120).default(60) }).optional())
    .query(async ({ input }) => {
      const events = await getMacroEvents(input?.days ?? 60);
      return events.map(toMacroEventDTO);
    }),

  /**
   * All upcoming earnings events (no portfolio filter).
   * isHolding is always false here — use earningsForHoldings for the flag.
   */
  earningsAll: publicProcedure
    .input(z.object({ days: z.number().min(1).max(120).default(90) }).optional())
    .query(async ({ input }) => {
      const events = await getEarningsEvents([], input?.days ?? 90);
      return events.map((e) => toEarningsEventDTO(e, false));
    }),

  /**
   * Earnings events filtered to the authenticated user's current holdings.
   * isHolding is true on every returned event.
   */
  earningsForHoldings: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(120).default(90) }).optional())
    .query(async ({ ctx, input }) => {
      const portfolio = await getDefaultPortfolio(ctx.userId);
      if (!portfolio) return [];
      const holdings = await getHoldings(portfolio.id);
      const tickers  = holdings.map((h) => h.ticker);
      const events   = await getEarningsForPortfolio(tickers, input?.days ?? 90);
      return events.map((e) => toEarningsEventDTO(e, true));
    }),
});
