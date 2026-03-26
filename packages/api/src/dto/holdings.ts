/**
 * Holdings DTOs — HoldingDTO, PriceBarDTO, PortfolioSummaryDTO.
 *
 * Returned by portfolio.holdingsWithHistory in a single response so the
 * holdings page makes one round-trip instead of 1 + N (one per position).
 */

// ─── Price bar ────────────────────────────────────────────────────────────────

/** Minimal OHLCV slice — only the closing price is needed for sparklines/charts */
export interface PriceBarDTO {
  /** YYYY-MM-DD */
  date:  string;
  close: number;
}

// ─── Individual holding ───────────────────────────────────────────────────────

export interface HoldingDTO {
  positionId:       string;
  securityId:       string;
  ticker:           string;
  name:             string;
  assetClass:       string;
  sector:           string | null;
  shares:           number;
  avgCostBasis:     number;
  currentPrice:     number;
  previousClose:    number;
  marketValue:      number;
  totalCost:        number;
  unrealizedPnl:    number;
  unrealizedPnlPct: number;
  dailyPnl:         number;
  dailyChangePct:   number;
  portfolioWeight:  number;
  /** 30-day daily closes, oldest-first */
  priceHistory:     PriceBarDTO[];
}

// ─── Portfolio summary ────────────────────────────────────────────────────────

export interface PortfolioSummaryDTO {
  portfolioId:      string;
  portfolioName:    string;
  currency:         string;
  positionCount:    number;
  totalValue:       number;
  investedCapital:  number;
  cashBalance:      number;
  unrealizedPnl:    number;
  unrealizedPnlPct: number;
  dailyPnl:         number;
  dailyPnlPct:      number;
  totalReturn:      number;
  totalReturnPct:   number;
}

// ─── Composite page payload ───────────────────────────────────────────────────

export interface HoldingsWithHistoryDTO {
  holdings:         HoldingDTO[];
  /** Aggregate portfolio value by date, oldest-first. Used for the 30-day chart. */
  portfolioHistory: PriceBarDTO[];
  summary:          PortfolioSummaryDTO | null;
}
