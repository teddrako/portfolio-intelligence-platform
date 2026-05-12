/**
 * Pure DCF (Discounted Cash Flow) engine.
 *
 * Model used: FCFF-based DCF
 *   FCFF = EBIT × (1 − τ) + D&A − ΔWC − CapEx
 *   Terminal value = FCFF_n × (1 + g) / (WACC − g)
 *   Equity value  = PV(projected FCFFs) + PV(TV) − Net Debt
 *   Intrinsic /share = Equity value / diluted shares outstanding
 *
 * All functions are pure (no I/O) so they can be unit-tested in isolation.
 */

import type { FundamentalsRow } from "./fundamentals";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DcfAssumptions {
  wacc:            number;   // e.g. 0.10 = 10 %
  terminalGrowth:  number;   // e.g. 0.025 = 2.5 %
  projectionYears: number;   // e.g. 5
  fcffGrowthRate:  number;   // explicit override, e.g. 0.07 = 7 % year-over-year
}

export interface FcffProjectionRow {
  year:   number;
  fcff:   number;
  pv:     number;
}

export interface DcfResult {
  intrinsicValue:  number;         // per-share fair value
  enterpriseValue: number;
  equityValue:     number;
  pvOfProjected:   number;
  pvOfTerminal:    number;
  terminalValue:   number;
  projectedFcff:   FcffProjectionRow[];
  baseFcff:        number;         // FCFF used as Year-0 base
  netDebt:         number;
  sharesOutstanding: number;
  upDownside:      number | null;  // % vs currentPrice; null if no price given
}

export interface SensitivityCell {
  wacc:           number;
  terminalGrowth: number;
  intrinsicValue: number;
  upDownside:     number | null;
}

// ─── Historical FCFF ─────────────────────────────────────────────────────────

/**
 * Derive FCFF from a single annual fundamentals row using the EBIT approach:
 *   FCFF = EBIT × (1 − taxRate) + Depreciation − CapEx
 *
 * Falls back to reported freeCashFlow when EBIT is unavailable.
 */
export function computeHistoricalFCFF(row: FundamentalsRow): number {
  if (row.ebit !== 0) {
    return row.ebit * (1 - row.taxRate) + row.depreciation - row.capitalExpenditures;
  }
  // Fallback: use reported FCF (less precise but better than nothing)
  return row.freeCashFlow;
}

/**
 * Geometric average FCFF growth rate over the supplied history.
 * Returns the supplied fallback if fewer than 2 data points.
 */
export function computeHistoricalGrowthRate(
  history: FundamentalsRow[],
  fallback = 0.05,
): number {
  if (history.length < 2) return fallback;

  const fcffs = history
    .slice()
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map(computeHistoricalFCFF);

  // Filter to positive values (can't compute log-returns on negatives)
  const pos = fcffs.filter((v) => v > 0);
  if (pos.length < 2) return fallback;

  const first = pos[0]!;
  const last  = pos[pos.length - 1]!;
  const n     = pos.length - 1;

  const cagr = Math.pow(last / first, 1 / n) - 1;
  // Cap to a reasonable range: [-20%, +40%]
  return Math.max(-0.2, Math.min(0.4, cagr));
}

// ─── DCF engine ──────────────────────────────────────────────────────────────

/** Projects FCFF forward and discounts each year to present value. */
export function projectFcff(
  baseFcff:    number,
  growthRate:  number,
  wacc:        number,
  years:       number,
): FcffProjectionRow[] {
  const rows: FcffProjectionRow[] = [];
  let fcff = baseFcff;
  for (let y = 1; y <= years; y++) {
    fcff *= 1 + growthRate;
    const pv = fcff / Math.pow(1 + wacc, y);
    rows.push({ year: y, fcff, pv });
  }
  return rows;
}

/** Gordon Growth terminal value (end of projection horizon). */
export function computeTerminalValue(
  lastFcff:       number,
  terminalGrowth: number,
  wacc:           number,
): number {
  if (wacc <= terminalGrowth) return 0; // undefined; guard against division by ~0
  return (lastFcff * (1 + terminalGrowth)) / (wacc - terminalGrowth);
}

/** PV of terminal value discounted back `years`. */
export function discountTerminalValue(
  terminalValue: number,
  wacc:          number,
  years:         number,
): number {
  return terminalValue / Math.pow(1 + wacc, years);
}

/**
 * Full DCF run.
 *
 * @param mostRecent  - The most recent annual fundamentals row (for balance-sheet items)
 * @param history     - All available history rows (for FCFF base + growth)
 * @param assumptions - User-supplied or default assumptions
 * @param currentPrice - Optional market price for upside/downside calc
 */
export function runDCF(
  mostRecent:   FundamentalsRow,
  history:      FundamentalsRow[],
  assumptions:  DcfAssumptions,
  currentPrice: number | null = null,
): DcfResult {
  const { wacc, terminalGrowth, projectionYears, fcffGrowthRate } = assumptions;

  const baseFcff = computeHistoricalFCFF(mostRecent);

  const projectedFcff = projectFcff(baseFcff, fcffGrowthRate, wacc, projectionYears);

  const pvOfProjected = projectedFcff.reduce((sum, r) => sum + r.pv, 0);

  const lastFcff = projectedFcff[projectedFcff.length - 1]?.fcff ?? baseFcff;
  const tv       = computeTerminalValue(lastFcff, terminalGrowth, wacc);
  const pvOfTV   = discountTerminalValue(tv, wacc, projectionYears);

  const enterpriseValue = pvOfProjected + pvOfTV;

  const netDebt         = mostRecent.totalDebt - mostRecent.cashAndEquivalents;
  const equityValue     = Math.max(0, enterpriseValue - netDebt);
  const shares          = mostRecent.sharesOutstanding;

  const intrinsicValue  = shares > 0 ? equityValue / shares : 0;

  const upDownside =
    currentPrice && currentPrice > 0 && intrinsicValue > 0
      ? ((intrinsicValue - currentPrice) / currentPrice) * 100
      : null;

  return {
    intrinsicValue,
    enterpriseValue,
    equityValue,
    pvOfProjected,
    pvOfTerminal: pvOfTV,
    terminalValue: tv,
    projectedFcff,
    baseFcff,
    netDebt,
    sharesOutstanding: shares,
    upDownside,
  };
}

// ─── Sensitivity grid ─────────────────────────────────────────────────────────

/**
 * Runs a 5×5 sensitivity grid: WACC ± 2 steps × terminal growth ± 2 steps.
 * Returns a flat array of cells for easy rendering.
 */
export function runSensitivity(
  mostRecent:      FundamentalsRow,
  history:         FundamentalsRow[],
  base:            DcfAssumptions,
  currentPrice:    number | null,
  waccStep    = 0.01,   // ±1% steps
  tGrowthStep = 0.005,  // ±0.5% steps
): SensitivityCell[] {
  const waccOffsets     = [-2, -1, 0, 1, 2];
  const tGrowthOffsets  = [-2, -1, 0, 1, 2];

  const cells: SensitivityCell[] = [];

  for (const dw of waccOffsets) {
    for (const dg of tGrowthOffsets) {
      const wacc    = Math.max(0.01, base.wacc + dw * waccStep);
      const tGrowth = Math.max(0, Math.min(wacc - 0.001, base.terminalGrowth + dg * tGrowthStep));

      const result = runDCF(mostRecent, history, { ...base, wacc, terminalGrowth: tGrowth }, currentPrice);
      cells.push({
        wacc,
        terminalGrowth: tGrowth,
        intrinsicValue: result.intrinsicValue,
        upDownside:     result.upDownside,
      });
    }
  }

  return cells;
}

// ─── Default assumptions ─────────────────────────────────────────────────────

/**
 * Suggests reasonable default assumptions given fundamentals history.
 * The user can override any of these in the UI.
 */
export function suggestAssumptions(
  history: FundamentalsRow[],
  sectorWacc = 0.10,
): DcfAssumptions {
  const historicalGrowth = computeHistoricalGrowthRate(history, 0.05);

  // Blend historical with a conservative long-run expectation
  const blendedGrowth = historicalGrowth * 0.6 + 0.04 * 0.4;
  const cappedGrowth  = Math.max(-0.05, Math.min(0.25, blendedGrowth));

  return {
    wacc:            sectorWacc,
    terminalGrowth:  0.025,
    projectionYears: 5,
    fcffGrowthRate:  cappedGrowth,
  };
}
