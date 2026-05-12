/**
 * Fundamentals service — fetches income statement, cash flow, and balance
 * sheet data from Financial Modeling Prep (FMP) and caches results in the
 * financial_statements table to avoid burning free-tier quota (250 req/day).
 *
 * Uses the FMP "stable" API (post-August 2025 endpoint structure).
 * Set FMP_API_KEY in env. Without a key the service returns empty arrays.
 */

import { db } from "@pip/db/db";
import { financialStatements, securities } from "@pip/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const API_KEY  = process.env.FMP_API_KEY ?? "";

// ─── FMP stable API response shapes ──────────────────────────────────────────

interface FmpIncomeStatement {
  fiscalYear:                string;
  period:                    string;
  revenue:                   number;
  grossProfit:               number;
  operatingIncome:           number;   // = EBIT in most cases
  ebit:                      number;
  ebitda:                    number;
  netIncome:                 number;
  eps:                       number;
  epsDiluted:                number;
  weightedAverageShsOutDil:  number;
  interestExpense:           number;
  incomeTaxExpense:          number;
  incomeBeforeTax:           number;
  depreciationAndAmortization: number;
}

interface FmpCashFlowStatement {
  fiscalYear:                              string;
  period:                                  string;
  netCashProvidedByOperatingActivities:    number;
  investmentsInPropertyPlantAndEquipment:  number;  // negative value
  freeCashFlow:                            number;
  depreciationAndAmortization:             number;
}

interface FmpBalanceSheet {
  fiscalYear:                string;
  period:                    string;
  totalDebt:                 number;
  cashAndCashEquivalents:    number;
  totalAssets:               number;
  totalStockholdersEquity:   number;
}

// ─── Low-level FMP fetcher ────────────────────────────────────────────────────

async function fmpGet<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  if (!API_KEY) return [];

  const qs  = new URLSearchParams({ ...params, apikey: API_KEY });
  const url = `${FMP_BASE}${path}?${qs}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`[fmp] ${path} → HTTP ${res.status}`);
      return [];
    }
    const data = await res.json() as T[] | { "Error Message"?: string };
    if (!Array.isArray(data)) {
      if ((data as Record<string, unknown>)["Error Message"]) {
        console.warn("[fmp] API error:", (data as Record<string, unknown>)["Error Message"]);
      }
      return [];
    }
    return data;
  } catch (err) {
    console.warn(`[fmp] fetch error for ${path}:`, err);
    return [];
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getSecurityId(ticker: string): Promise<string | null> {
  const rows = await db
    .select({ id: securities.id })
    .from(securities)
    .where(eq(securities.ticker, ticker))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getStoredStatements(ticker: string, years = 5) {
  const upper = ticker.toUpperCase();
  return db
    .select()
    .from(financialStatements)
    .where(
      and(
        eq(financialStatements.ticker, upper),
        eq(financialStatements.period, "FY"),
      ),
    )
    .orderBy(desc(financialStatements.fiscalYear))
    .limit(years);
}

async function cacheAgeMs(ticker: string): Promise<number> {
  const rows = await db
    .select({ fetchedAt: financialStatements.fetchedAt })
    .from(financialStatements)
    .where(eq(financialStatements.ticker, ticker.toUpperCase()))
    .orderBy(desc(financialStatements.fetchedAt))
    .limit(1);
  if (!rows[0]) return Infinity;
  return Date.now() - rows[0].fetchedAt.getTime();
}

// ─── Fetch & upsert ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function fetchAndStoreFundamentals(ticker: string, years = 5): Promise<void> {
  const upper = ticker.toUpperCase();

  const ageMs = await cacheAgeMs(upper);
  if (ageMs < CACHE_TTL_MS) return;

  if (!API_KEY) {
    console.warn("[fmp] FMP_API_KEY not set — skipping fetch for", upper);
    return;
  }

  const securityId = await getSecurityId(upper); // null is fine — securityId is now nullable

  const limit = String(years);
  const [incomeRows, cashFlowRows, balanceRows] = await Promise.all([
    fmpGet<FmpIncomeStatement>("/income-statement",    { symbol: upper, limit, period: "annual" }),
    fmpGet<FmpCashFlowStatement>("/cash-flow-statement", { symbol: upper, limit, period: "annual" }),
    fmpGet<FmpBalanceSheet>("/balance-sheet-statement",  { symbol: upper, limit, period: "annual" }),
  ]);

  if (incomeRows.length === 0) {
    console.warn("[fmp] no income statement data returned for", upper);
    return;
  }

  // Join by fiscalYear
  const cashByYear = new Map(cashFlowRows.map((r) => [r.fiscalYear, r]));
  const balByYear  = new Map(balanceRows.map((r) => [r.fiscalYear, r]));

  const rows = incomeRows.map((inc) => {
    const year = inc.fiscalYear;
    const cf   = cashByYear.get(year);
    const bal  = balByYear.get(year);

    const taxRate =
      inc.incomeBeforeTax !== 0
        ? Math.max(0, Math.min(0.5, inc.incomeTaxExpense / inc.incomeBeforeTax))
        : 0.25;

    // DA is available in both income and CF statements; prefer CF as it's more precise
    const da = cf?.depreciationAndAmortization ?? inc.depreciationAndAmortization ?? 0;

    // CapEx is negative in the stable API
    const capex = Math.abs(cf?.investmentsInPropertyPlantAndEquipment ?? 0);

    return {
      id:                  randomUUID(),
      securityId:          securityId ?? null,
      ticker:              upper,
      fiscalYear:          parseInt(year, 10),
      period:              "FY",
      revenue:             String(inc.revenue ?? 0),
      grossProfit:         String(inc.grossProfit ?? 0),
      operatingIncome:     String(inc.operatingIncome ?? 0),
      netIncome:           String(inc.netIncome ?? 0),
      ebit:                String(inc.ebit ?? inc.operatingIncome ?? 0),
      ebitda:              String(inc.ebitda ?? 0),
      eps:                 String(inc.epsDiluted ?? inc.eps ?? 0),
      sharesOutstanding:   String(inc.weightedAverageShsOutDil ?? 0),
      interestExpense:     String(Math.abs(inc.interestExpense ?? 0)),
      taxRate:             String(taxRate),
      operatingCashFlow:   String(cf?.netCashProvidedByOperatingActivities ?? 0),
      capitalExpenditures: String(capex),
      freeCashFlow:        String(cf?.freeCashFlow ?? 0),
      depreciation:        String(da),
      totalDebt:           String(bal?.totalDebt ?? 0),
      cashAndEquivalents:  String(bal?.cashAndCashEquivalents ?? 0),
      totalAssets:         String(bal?.totalAssets ?? 0),
      totalEquity:         String(bal?.totalStockholdersEquity ?? 0),
      fetchedAt:           new Date(),
    };
  });

  if (rows.length === 0) return;

  await db
    .insert(financialStatements)
    .values(rows)
    .onConflictDoUpdate({
      target: [financialStatements.ticker, financialStatements.fiscalYear, financialStatements.period],
      set: {
        revenue:             sql`excluded.revenue`,
        grossProfit:         sql`excluded.gross_profit`,
        operatingIncome:     sql`excluded.operating_income`,
        netIncome:           sql`excluded.net_income`,
        ebit:                sql`excluded.ebit`,
        ebitda:              sql`excluded.ebitda`,
        eps:                 sql`excluded.eps`,
        sharesOutstanding:   sql`excluded.shares_outstanding`,
        interestExpense:     sql`excluded.interest_expense`,
        taxRate:             sql`excluded.tax_rate`,
        operatingCashFlow:   sql`excluded.operating_cash_flow`,
        capitalExpenditures: sql`excluded.capital_expenditures`,
        freeCashFlow:        sql`excluded.free_cash_flow`,
        depreciation:        sql`excluded.depreciation`,
        totalDebt:           sql`excluded.total_debt`,
        cashAndEquivalents:  sql`excluded.cash_and_equivalents`,
        totalAssets:         sql`excluded.total_assets`,
        totalEquity:         sql`excluded.total_equity`,
        fetchedAt:           sql`now()`,
      },
    });

  console.log(`[fmp] stored ${rows.length} years for ${upper}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FundamentalsRow {
  fiscalYear:          number;
  revenue:             number;
  grossProfit:         number;
  operatingIncome:     number;
  netIncome:           number;
  ebit:                number;
  ebitda:              number;
  eps:                 number;
  sharesOutstanding:   number;
  operatingCashFlow:   number;
  capitalExpenditures: number;
  freeCashFlow:        number;
  depreciation:        number;
  totalDebt:           number;
  cashAndEquivalents:  number;
  totalAssets:         number;
  totalEquity:         number;
  interestExpense:     number;
  taxRate:             number;
}

function parseRow(row: typeof financialStatements.$inferSelect): FundamentalsRow {
  return {
    fiscalYear:          row.fiscalYear,
    revenue:             parseFloat(row.revenue ?? "0"),
    grossProfit:         parseFloat(row.grossProfit ?? "0"),
    operatingIncome:     parseFloat(row.operatingIncome ?? "0"),
    netIncome:           parseFloat(row.netIncome ?? "0"),
    ebit:                parseFloat(row.ebit ?? "0"),
    ebitda:              parseFloat(row.ebitda ?? "0"),
    eps:                 parseFloat(row.eps ?? "0"),
    sharesOutstanding:   parseFloat(row.sharesOutstanding ?? "0"),
    operatingCashFlow:   parseFloat(row.operatingCashFlow ?? "0"),
    capitalExpenditures: parseFloat(row.capitalExpenditures ?? "0"),
    freeCashFlow:        parseFloat(row.freeCashFlow ?? "0"),
    depreciation:        parseFloat(row.depreciation ?? "0"),
    totalDebt:           parseFloat(row.totalDebt ?? "0"),
    cashAndEquivalents:  parseFloat(row.cashAndEquivalents ?? "0"),
    totalAssets:         parseFloat(row.totalAssets ?? "0"),
    totalEquity:         parseFloat(row.totalEquity ?? "0"),
    interestExpense:     parseFloat(row.interestExpense ?? "0"),
    taxRate:             parseFloat(row.taxRate ?? "0.25"),
  };
}

export async function getFundamentals(ticker: string, years = 5): Promise<FundamentalsRow[]> {
  const upper = ticker.toUpperCase();
  await fetchAndStoreFundamentals(upper, years);
  const rows = await getStoredStatements(upper, years);
  return rows.map(parseRow);
}

export function hasFmpKey(): boolean {
  return Boolean(API_KEY);
}
