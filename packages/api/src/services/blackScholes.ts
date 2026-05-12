/**
 * Black-Scholes European options pricing model — pure math, no I/O.
 *
 * Conventions:
 *   S     — current underlying price
 *   K     — strike price
 *   T     — time to expiration in years (e.g. 90 days = 90/365 ≈ 0.2466)
 *   r     — continuously-compounded risk-free rate (e.g. 0.05 = 5%)
 *   sigma — annualised implied volatility (e.g. 0.25 = 25%)
 *
 * Greeks are expressed as market-standard per-share sensitivities.
 * Multiply by 100 for per-contract values (standard lot = 100 shares).
 */

// ─── Standard normal functions ────────────────────────────────────────────────

/** Rational approximation of the error function (Horner's method, max error ~1.5e-7). */
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x >= 0 ? 1 : -1;
  const t  = 1 / (1 + p * Math.abs(x));
  const y  = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

/** Standard normal CDF: Φ(x) */
export function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Standard normal PDF: φ(x) */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ─── d1 / d2 ─────────────────────────────────────────────────────────────────

export function d1(S: number, K: number, T: number, r: number, sigma: number): number {
  return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

export function d2(S: number, K: number, T: number, r: number, sigma: number): number {
  return d1(S, K, T, r, sigma) - sigma * Math.sqrt(T);
}

// ─── Option price ─────────────────────────────────────────────────────────────

export function callPrice(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(0, S - K);
  const _d1 = d1(S, K, T, r, sigma);
  const _d2 = d2(S, K, T, r, sigma);
  return S * normalCDF(_d1) - K * Math.exp(-r * T) * normalCDF(_d2);
}

export function putPrice(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(0, K - S);
  const _d1 = d1(S, K, T, r, sigma);
  const _d2 = d2(S, K, T, r, sigma);
  return K * Math.exp(-r * T) * normalCDF(-_d2) - S * normalCDF(-_d1);
}

export function optionPrice(
  type:  "call" | "put",
  S: number, K: number, T: number, r: number, sigma: number,
): number {
  return type === "call" ? callPrice(S, K, T, r, sigma) : putPrice(S, K, T, r, sigma);
}

// ─── Greeks ───────────────────────────────────────────────────────────────────

export interface Greeks {
  delta: number;    // rate of change vs. underlying price
  gamma: number;    // rate of change of delta
  theta: number;    // time decay per calendar day
  vega:  number;    // sensitivity to 1% change in IV
  rho:   number;    // sensitivity to 1% change in risk-free rate
}

export function computeGreeks(
  type:  "call" | "put",
  S: number, K: number, T: number, r: number, sigma: number,
): Greeks {
  if (T <= 0 || sigma <= 0) {
    // At or past expiration — intrinsic Greeks
    const delta = type === "call" ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
    return { delta, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const _d1   = d1(S, K, T, r, sigma);
  const _d2   = d2(S, K, T, r, sigma);
  const phi1  = normalPDF(_d1);
  const disc  = Math.exp(-r * T);

  const delta = type === "call"
    ? normalCDF(_d1)
    : normalCDF(_d1) - 1;

  const gamma = phi1 / (S * sigma * sqrtT);

  // Theta: time decay per calendar day (annualised BS / 365)
  const theta = type === "call"
    ? ((-S * phi1 * sigma / (2 * sqrtT)) - r * K * disc * normalCDF(_d2)) / 365
    : ((-S * phi1 * sigma / (2 * sqrtT)) + r * K * disc * normalCDF(-_d2)) / 365;

  // Vega: per 1% change in volatility (annualised vega / 100)
  const vega = S * phi1 * sqrtT / 100;

  // Rho: per 1% change in risk-free rate
  const rho = type === "call"
    ? K * T * disc * normalCDF(_d2) / 100
    : -K * T * disc * normalCDF(-_d2) / 100;

  return { delta, gamma, theta, vega, rho };
}

// ─── Implied Volatility ───────────────────────────────────────────────────────

const IV_MAX_ITER = 100;
const IV_TOL      = 1e-6;
const IV_MIN      = 0.001;
const IV_MAX      = 10;   // 1000 % vol cap

/**
 * Compute implied volatility via Newton-Raphson with bisection fallback.
 * Returns null if the market price is below intrinsic value or IV can't converge.
 */
export function impliedVolatility(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  type: "call" | "put",
): number | null {
  if (T <= 0) return null;

  // Intrinsic value guard
  const intrinsic =
    type === "call" ? Math.max(0, S - K * Math.exp(-r * T)) : Math.max(0, K * Math.exp(-r * T) - S);
  if (marketPrice < intrinsic - 1e-4) return null;

  let sigma = 0.25; // initial guess: 25%

  for (let i = 0; i < IV_MAX_ITER; i++) {
    const price = optionPrice(type, S, K, T, r, sigma);
    const diff  = price - marketPrice;
    if (Math.abs(diff) < IV_TOL) return sigma;

    const sqrtT = Math.sqrt(T);
    const _d1   = d1(S, K, T, r, sigma);
    const vega  = S * normalPDF(_d1) * sqrtT; // annualised, not divided by 100

    if (Math.abs(vega) < 1e-10) break; // vega near zero → switch to bisection

    sigma = sigma - diff / vega;
    if (sigma < IV_MIN) sigma = IV_MIN;
    if (sigma > IV_MAX) sigma = IV_MAX;
  }

  // Bisection fallback
  let lo = IV_MIN, hi = IV_MAX;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const diff = optionPrice(type, S, K, T, r, mid) - marketPrice;
    if (Math.abs(diff) < IV_TOL) return mid;
    if (diff < 0) lo = mid; else hi = mid;
    if (hi - lo < IV_TOL) return (lo + hi) / 2;
  }

  return null;
}

// ─── Payoff at expiration ─────────────────────────────────────────────────────

export interface PayoffPoint {
  price:  number;
  payoff: number;  // net P&L per share at expiration (no time value)
}

/**
 * Generate a payoff diagram array for a single option leg.
 * @param premium — the option price paid / received per share
 * @param long    — true if long the option, false if short
 */
export function payoffAtExpiration(
  type:      "call" | "put",
  K:         number,
  premium:   number,
  long:      boolean,
  spotRange: [number, number],
  steps      = 80,
): PayoffPoint[] {
  const [lo, hi] = spotRange;
  const inc = (hi - lo) / steps;
  const sign = long ? 1 : -1;
  const points: PayoffPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const price = lo + i * inc;
    const intrinsic =
      type === "call" ? Math.max(0, price - K) : Math.max(0, K - price);
    points.push({ price, payoff: sign * (intrinsic - premium) });
  }

  return points;
}
