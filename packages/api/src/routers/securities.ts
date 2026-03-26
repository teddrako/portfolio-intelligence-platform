import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { mockSecurities } from "@pip/db/mock";

export const securitiesRouter = router({
  list: publicProcedure.query(() => mockSecurities),
  byTicker: publicProcedure
    .input(z.object({ ticker: z.string().toUpperCase() }))
    .query(({ input }) => mockSecurities.find((s) => s.ticker === input.ticker) ?? null),
});
