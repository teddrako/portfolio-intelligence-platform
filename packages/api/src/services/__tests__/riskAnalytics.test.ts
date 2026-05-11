import { test, expect, describe } from "bun:test";
import {
  computeBeta,
  computeRollingBeta,
  computeSectorExposure,
  computeHerfindahl,
  computeCorrelationMatrix,
  computeDrawdown,
  computePortfolioReturns,
  computeAnnualizedVol,
  normalizeSector,
} from "../riskAnalytics";

// ─── computeBeta ─────────────────────────────────────────────────────────────

describe("computeBeta", () => {
  test("identical returns → beta = 1", () => {
    const r = [0.01, -0.02, 0.005, 0.03, -0.01];
    expect(computeBeta(r, r)).toBeCloseTo(1.0, 6);
  });

  test("portfolio = 2× benchmark → beta = 2", () => {
    const b = [0.01, -0.02, 0.005, 0.03, -0.01, 0.02, -0.015];
    const p = b.map((v) => v * 2);
    expect(computeBeta(p, b)).toBeCloseTo(2.0, 6);
  });

  test("zero-variance benchmark → returns 1 (degenerate guard)", () => {
    const p = [0.01, 0.02, 0.03];
    const b = [0, 0, 0];
    expect(computeBeta(p, b)).toBe(1);
  });
});

// ─── computeRollingBeta ───────────────────────────────────────────────────────

describe("computeRollingBeta", () => {
  test("produces (n - window + 1) points", () => {
    const n = 80;
    const window = 20;
    const series = Array.from({ length: n }, (_, i) => ({
      date:   `2024-01-${String(i + 1).padStart(2, "0")}`,
      return: Math.sin(i * 0.1) * 0.01,
    }));
    const result = computeRollingBeta(series, series, window);
    expect(result.length).toBe(n - window + 1);
  });

  test("rolling beta of identical series is always 1", () => {
    const series = Array.from({ length: 100 }, (_, i) => ({
      date:   `2024-${String(Math.floor(i / 31) + 1).padStart(2, "0")}-${String((i % 31) + 1).padStart(2, "0")}`,
      return: (i % 7 - 3) * 0.005,
    }));
    const result = computeRollingBeta(series, series, 30);
    for (const { beta } of result) {
      expect(beta).toBeCloseTo(1, 5);
    }
  });
});

// ─── computeHerfindahl ────────────────────────────────────────────────────────

describe("computeHerfindahl", () => {
  test("four equal positions → 0.25", () => {
    expect(computeHerfindahl([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(0.25, 6);
  });

  test("single position → 1", () => {
    expect(computeHerfindahl([1])).toBeCloseTo(1, 6);
  });

  test("ten equal positions → 0.1", () => {
    const w = Array(10).fill(0.1);
    expect(computeHerfindahl(w)).toBeCloseTo(0.1, 6);
  });
});

// ─── computeSectorExposure ────────────────────────────────────────────────────

describe("computeSectorExposure", () => {
  test("aggregates across holdings in same sector", () => {
    const holdings = [
      { sector: "Technology",  marketValue: 40_000 },
      { sector: "Technology",  marketValue: 10_000 },
      { sector: "Financials",  marketValue: 50_000 },
    ];
    const result = computeSectorExposure(holdings);
    const tech = result.find((r) => r.sector === "Technology")!;
    expect(tech.weight).toBeCloseTo(0.5, 6);
    expect(tech.marketValue).toBe(50_000);
  });

  test("normalises Yahoo Finance sector names", () => {
    const holdings = [{ sector: "Consumer Cyclical", marketValue: 100 }];
    const result = computeSectorExposure(holdings);
    expect(result[0]!.sector).toBe("Consumer Discretionary");
  });

  test("null sector → 'Other'", () => {
    const holdings = [{ sector: null, marketValue: 100 }];
    expect(computeSectorExposure(holdings)[0]!.sector).toBe("Other");
  });
});

// ─── computeCorrelationMatrix ────────────────────────────────────────────────

describe("computeCorrelationMatrix", () => {
  test("diagonal is 1", () => {
    const r1 = [0.01, 0.02, -0.01, 0.005];
    const r2 = [0.005, -0.01, 0.02, 0.01];
    const m  = computeCorrelationMatrix([r1, r2]);
    expect(m[0]![0]).toBe(1);
    expect(m[1]![1]).toBe(1);
  });

  test("perfectly correlated series → off-diagonal = 1", () => {
    const base = [0.01, -0.02, 0.005, 0.03, -0.01, 0.02];
    const m    = computeCorrelationMatrix([base, base]);
    expect(m[0]![1]).toBeCloseTo(1, 5);
  });

  test("matrix is symmetric", () => {
    const r1 = [0.01, -0.01, 0.02, -0.005, 0.015];
    const r2 = [0.005, 0.02, -0.01, 0.025, -0.01];
    const r3 = [-0.01, 0.005, 0.03, -0.015, 0.01];
    const m  = computeCorrelationMatrix([r1, r2, r3]);
    expect(m[0]![1]).toBeCloseTo(m[1]![0]!, 10);
    expect(m[0]![2]).toBeCloseTo(m[2]![0]!, 10);
    expect(m[1]![2]).toBeCloseTo(m[2]![1]!, 10);
  });
});

// ─── computeDrawdown ─────────────────────────────────────────────────────────

describe("computeDrawdown", () => {
  test("all positive returns → drawdown always 0", () => {
    const returns = [
      { date: "2024-01-02", return: 0.01 },
      { date: "2024-01-03", return: 0.02 },
      { date: "2024-01-04", return: 0.005 },
    ];
    for (const { drawdown } of computeDrawdown(returns)) {
      expect(drawdown).toBeCloseTo(0, 10);
    }
  });

  test("loss after a peak produces correct drawdown", () => {
    const returns = [
      { date: "2024-01-02", return: 0.1  },  // value = 1.10, peak = 1.10
      { date: "2024-01-03", return: -0.1 },  // value = 0.99, peak = 1.10
    ];
    const dd = computeDrawdown(returns);
    expect(dd[0]!.drawdown).toBeCloseTo(0, 10);
    // drawdown = (0.99 - 1.10) / 1.10 ≈ -0.1
    expect(dd[1]!.drawdown).toBeCloseTo((0.99 - 1.10) / 1.10, 5);
  });
});

// ─── computePortfolioReturns ─────────────────────────────────────────────────

describe("computePortfolioReturns", () => {
  test("single holding → same as individual returns", () => {
    const prices = [
      { date: "2024-01-02", close: 100 },
      { date: "2024-01-03", close: 102 },
      { date: "2024-01-04", close: 101 },
    ];
    const series = new Map([["AAPL", prices]]);
    const returns = computePortfolioReturns([{ ticker: "AAPL", shares: 10 }], series);
    expect(returns.length).toBe(2);
    expect(returns[0]!.return).toBeCloseTo(0.02, 6);
    expect(returns[1]!.return).toBeCloseTo(-1 / 102, 6);
  });

  test("returns empty array with fewer than 2 common dates", () => {
    const series = new Map([["AAPL", [{ date: "2024-01-02", close: 100 }]]]);
    const returns = computePortfolioReturns([{ ticker: "AAPL", shares: 10 }], series);
    expect(returns).toHaveLength(0);
  });

  test("inner-joins dates — excludes dates missing in any holding", () => {
    const aaplPrices = [
      { date: "2024-01-02", close: 100 },
      { date: "2024-01-03", close: 102 },
      { date: "2024-01-04", close: 101 },
    ];
    const nvdaPrices = [
      { date: "2024-01-02", close: 500 },
      // Jan 03 missing
      { date: "2024-01-04", close: 510 },
    ];
    const series  = new Map([["AAPL", aaplPrices], ["NVDA", nvdaPrices]]);
    const holdings = [
      { ticker: "AAPL", shares: 1 },
      { ticker: "NVDA", shares: 1 },
    ];
    const returns = computePortfolioReturns(holdings, series);
    // Common dates are Jan 02 and Jan 04 only → 1 return (Jan 04)
    expect(returns.length).toBe(1);
    expect(returns[0]!.date).toBe("2024-01-04");
  });
});

// ─── computeAnnualizedVol ────────────────────────────────────────────────────

describe("computeAnnualizedVol", () => {
  test("returns null for fewer than 5 observations", () => {
    expect(computeAnnualizedVol([0.01, 0.02, -0.01])).toBeNull();
  });

  test("zero-vol series → 0", () => {
    const flat = Array(20).fill(0);
    expect(computeAnnualizedVol(flat)).toBeCloseTo(0, 10);
  });
});

// ─── normalizeSector ─────────────────────────────────────────────────────────

describe("normalizeSector", () => {
  test("maps Yahoo Finance names to standard names", () => {
    expect(normalizeSector("Consumer Cyclical")).toBe("Consumer Discretionary");
    expect(normalizeSector("Financial Services")).toBe("Financials");
    expect(normalizeSector("Basic Materials")).toBe("Materials");
    expect(normalizeSector("Consumer Defensive")).toBe("Consumer Staples");
  });

  test("passes through unknown sectors unchanged", () => {
    expect(normalizeSector("Technology")).toBe("Technology");
    expect(normalizeSector("Healthcare")).toBe("Healthcare");
  });

  test("null → 'Other'", () => {
    expect(normalizeSector(null)).toBe("Other");
  });
});
