import { router } from "./trpc";
import { portfolioRouter } from "./routers/portfolio";
import { securitiesRouter } from "./routers/securities";
import { newsRouter } from "./routers/news";
import { transactionsRouter } from "./routers/transactions";
import { aiReportsRouter } from "./routers/ai-reports";
import { calendarRouter } from "./routers/calendar";

export const appRouter = router({
  portfolio:    portfolioRouter,
  securities:   securitiesRouter,
  news:         newsRouter,
  transactions: transactionsRouter,
  aiReports:    aiReportsRouter,
  calendar:     calendarRouter,
});

export type AppRouter = typeof appRouter;

export { createContext } from "./context";
export { createCallerFactory } from "./trpc";

// Internal service types (used by server-side code and the positions page)
export type { PositionWithMetrics, PortfolioSummary, RecentTransaction } from "./services/portfolio";
export type { Quote, HistoricalBar, PriceData }                         from "./services/prices";

// DTOs — the shapes the frontend receives from tRPC
export type {
  NewsArticleDTO,
  MacroEventDTO,
  EarningsEventDTO,
  HoldingDTO,
  PriceBarDTO,
  PortfolioSummaryDTO,
  HoldingsWithHistoryDTO,
  ReportDTO,
} from "./dto";
