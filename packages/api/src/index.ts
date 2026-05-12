import { router } from "./trpc";
import { portfolioRouter } from "./routers/portfolio";
import { securitiesRouter } from "./routers/securities";
import { newsRouter } from "./routers/news";
import { transactionsRouter } from "./routers/transactions";
import { aiReportsRouter } from "./routers/ai-reports";
import { calendarRouter } from "./routers/calendar";
import { emailRouter } from "./routers/email";
import { riskRouter } from "./routers/risk";
import { valuationRouter } from "./routers/valuation";
import { optionsRouter } from "./routers/options";
import { backtestRouter } from "./routers/backtest";

export const appRouter = router({
  portfolio:    portfolioRouter,
  securities:   securitiesRouter,
  news:         newsRouter,
  transactions: transactionsRouter,
  aiReports:    aiReportsRouter,
  calendar:     calendarRouter,
  email:        emailRouter,
  risk:         riskRouter,
  valuation:    valuationRouter,
  options:      optionsRouter,
  backtest:     backtestRouter,
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
export type { RiskMetricsDTO } from "./routers/risk";
export type { DcfResultDTO, SensitivityDTO, PortfolioValuationSummaryDTO, FcffRowDTO } from "./routers/valuation";
export type { OptionsChainDTO, OptionContractDTO, PayoffDTO, HoldingTickerDTO } from "./routers/options";
export type { BacktestResultDTO } from "./routers/backtest";
