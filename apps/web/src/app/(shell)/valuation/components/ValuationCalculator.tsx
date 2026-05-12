"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Download, Zap } from "lucide-react";
import type { DcfResultDTO, FcffRowDTO, PortfolioValuationSummaryDTO, SensitivityDTO } from "@pip/api";

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtM(n: number): string {
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

function fmtDollar(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtPct(n: number, dec = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(dec)}%`;
}

function fmtPctNeutral(n: number | null, dec = 1): string {
  if (n === null) return "—";
  return `${n.toFixed(dec)}%`;
}

function fmtMultiple(n: number | null, suffix = "x"): string {
  if (n === null || !isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(1)}${suffix}`;
}

function updownColor(pct: number | null): string {
  if (pct === null) return "text-gray-500";
  if (pct >= 20)  return "text-emerald-400";
  if (pct >= 0)   return "text-green-400";
  if (pct >= -20) return "text-yellow-400";
  return "text-red-400";
}

function marginColor(pct: number | null): string {
  if (pct === null) return "text-gray-500";
  if (pct >= 20)  return "text-emerald-400";
  if (pct >= 10)  return "text-green-400";
  if (pct >= 0)   return "text-gray-400";
  return "text-red-400";
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCsv(ticker: string, dcf: DcfResultDTO, sens?: SensitivityDTO) {
  const lines: string[] = [];

  const row = (...cells: (string | number | null | undefined)[]) => {
    lines.push(
      cells.map((c) => {
        if (c === null || c === undefined) return "";
        const s = String(c);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","),
    );
  };

  const sep = () => lines.push("");
  const heading = (title: string) => { sep(); row(title); };

  // ── Header
  row("DCF VALUATION MODEL", ticker);
  row("Generated", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
  row("Model", "FCFF-based DCF — EBIT × (1−t) + D&A − CapEx");
  row("Source", "Financial Modeling Prep (FMP)");

  // ── Assumptions
  heading("ASSUMPTIONS");
  row("Parameter", "Value");
  row("WACC", fmtPctNeutral(dcf.assumptions.wacc * 100));
  row("Terminal Growth Rate", fmtPctNeutral(dcf.assumptions.terminalGrowth * 100));
  row("FCFF Growth Rate (projected)", fmtPctNeutral(dcf.assumptions.fcffGrowthRate * 100));
  row("Projection Years", dcf.assumptions.projectionYears);

  // ── Valuation summary
  heading("VALUATION SUMMARY");
  row("Metric", "Value");
  row("Intrinsic Value / Share", dcf.intrinsicValue.toFixed(2));
  row("Current Market Price", dcf.currentPrice?.toFixed(2) ?? "N/A");
  row("Up / Downside (%)", dcf.upDownside?.toFixed(1) ?? "N/A");
  row("Enterprise Value", dcf.enterpriseValue.toFixed(0));
  row("Equity Value", dcf.equityValue.toFixed(0));
  row("PV of Projected FCFFs", dcf.pvOfProjected.toFixed(0));
  row("PV of Terminal Value", dcf.pvOfTerminal.toFixed(0));
  row("Terminal Value (undiscounted)", dcf.terminalValue.toFixed(0));
  row("Net Debt", dcf.netDebt.toFixed(0));
  row("Shares Outstanding", dcf.sharesOutstanding.toFixed(0));

  // ── EV Multiples
  heading("EV MULTIPLES (MOST RECENT YEAR)");
  row("Multiple", "Value");
  row("EV / EBITDA", fmtMultiple(dcf.evToEbitda));
  row("EV / Revenue", fmtMultiple(dcf.evToRevenue));
  row("Price / Earnings (P/E)", fmtMultiple(dcf.priceToEarnings));
  row("EV / FCFF", fmtMultiple(dcf.evToFcf));

  // ── Historical Income Statement
  heading("INCOME STATEMENT (Historical Annual)");
  row("Year", "Revenue", "Gross Profit", "EBITDA", "EBIT", "Interest Exp.", "Net Income", "EPS",
      "Gross Margin %", "EBIT Margin %", "Net Margin %", "Revenue Growth %");
  for (const h of dcf.historicalFcff) {
    row(
      h.fiscalYear,
      h.revenue.toFixed(0),
      h.grossProfit.toFixed(0),
      h.ebitda.toFixed(0),
      h.ebit.toFixed(0),
      h.interestExpense.toFixed(0),
      h.netIncome.toFixed(0),
      h.eps.toFixed(2),
      fmtPctNeutral(h.grossMargin),
      fmtPctNeutral(h.ebitMargin),
      fmtPctNeutral(h.netMargin),
      h.revenueGrowth !== null ? h.revenueGrowth.toFixed(1) : "—",
    );
  }

  // ── FCF Bridge
  heading("FREE CASH FLOW BRIDGE (Historical)");
  row("Year", "EBIT", "Tax Rate", "NOPAT", "D&A", "CapEx", "FCFF", "Op. Cash Flow", "Reported FCF",
      "Total Debt", "Cash", "Net Debt", "Total Equity");
  for (const h of dcf.historicalFcff) {
    row(
      h.fiscalYear,
      h.ebit.toFixed(0),
      fmtPctNeutral(h.taxRate * 100),
      h.nopat.toFixed(0),
      h.depreciation.toFixed(0),
      h.capitalExpenditures.toFixed(0),
      h.fcff.toFixed(0),
      h.operatingCashFlow.toFixed(0),
      h.freeCashFlow.toFixed(0),
      h.totalDebt.toFixed(0),
      h.cashAndEquivalents.toFixed(0),
      (h.totalDebt - h.cashAndEquivalents).toFixed(0),
      h.totalEquity.toFixed(0),
    );
  }

  // ── DCF Projections
  heading("DCF PROJECTIONS");
  row("Year", "FCFF", "Discount Factor", "PV(FCFF)");
  for (const p of dcf.projectedFcff) {
    const df = 1 / Math.pow(1 + dcf.assumptions.wacc, p.year);
    row(`Y+${p.year}`, p.fcff.toFixed(0), df.toFixed(4), p.pv.toFixed(0));
  }
  row("Terminal Value", dcf.terminalValue.toFixed(0), "", dcf.pvOfTerminal.toFixed(0));
  sep();
  row("PV of Projected FCFFs", dcf.pvOfProjected.toFixed(0));
  row("PV of Terminal Value", dcf.pvOfTerminal.toFixed(0));
  row("Enterprise Value", dcf.enterpriseValue.toFixed(0));
  row("Less: Net Debt", dcf.netDebt.toFixed(0));
  row("Equity Value", dcf.equityValue.toFixed(0));
  row("Shares Outstanding", dcf.sharesOutstanding.toFixed(0));
  row("Intrinsic Value / Share", dcf.intrinsicValue.toFixed(2));

  // ── Sensitivity Grid
  if (sens && sens.cells.length > 0) {
    heading("SENSITIVITY ANALYSIS (Intrinsic Value / Share)");
    row("WACC \\ Terminal Growth", ...sens.terminalGrowthValues.map((v) => `${(v * 100).toFixed(1)}%`));
    for (const w of sens.waccValues) {
      const vals = sens.terminalGrowthValues.map((tg) => {
        const cell = sens.cells.find(
          (c) => Math.abs(c.wacc - w) < 0.0001 && Math.abs(c.terminalGrowth - tg) < 0.0001,
        );
        return cell ? cell.intrinsicValue.toFixed(2) : "";
      });
      row(`${(w * 100).toFixed(1)}%`, ...vals);
    }
  }

  const csv  = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${ticker}_DCF_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  hint,
  onChange,
}: {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step:     number;
  format:   (v: number) => string;
  hint?:    string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-500">{label}</span>
        <div className="flex items-center gap-2">
          {hint && <span className="text-[9px] text-gray-700 tabular-nums">Sug: {hint}</span>}
          <span className="text-[11px] font-semibold tabular-nums text-gray-200">{format(value)}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-indigo-400 cursor-pointer"
      />
    </div>
  );
}

// ─── Sensitivity grid ─────────────────────────────────────────────────────────

function SensitivityGrid({
  cells,
  waccValues,
  tGrowthValues,
  currentPrice,
}: {
  cells:         Array<{ wacc: number; terminalGrowth: number; intrinsicValue: number; upDownside: number | null }>;
  waccValues:    number[];
  tGrowthValues: number[];
  currentPrice:  number | null;
}) {
  if (cells.length === 0) return null;
  const cellMap = new Map(cells.map((c) => [`${c.wacc.toFixed(4)}-${c.terminalGrowth.toFixed(4)}`, c]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr>
            <th className="py-1 pr-2 text-left text-gray-600 font-normal">WACC \ TGR</th>
            {tGrowthValues.map((tg) => (
              <th key={tg} className="px-1 py-1 text-center font-semibold text-gray-500 tabular-nums">
                {(tg * 100).toFixed(1)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {waccValues.map((w) => (
            <tr key={w}>
              <td className="py-0.5 pr-2 font-semibold text-gray-500 tabular-nums">{(w * 100).toFixed(1)}%</td>
              {tGrowthValues.map((tg) => {
                const cell = cellMap.get(`${w.toFixed(4)}-${tg.toFixed(4)}`);
                const iv   = cell?.intrinsicValue ?? 0;
                const ud   = cell?.upDownside ?? null;
                const bg   =
                  ud === null  ? "bg-gray-800 text-gray-500"
                  : ud >= 30  ? "bg-emerald-500/25 text-emerald-300"
                  : ud >= 10  ? "bg-green-500/15 text-green-400"
                  : ud >= -10 ? "bg-gray-700 text-gray-300"
                  : ud >= -30 ? "bg-yellow-500/15 text-yellow-400"
                  :              "bg-red-500/20 text-red-400";
                return (
                  <td key={tg} className={`px-1 py-0.5 text-center rounded tabular-nums ${bg}`}>
                    {fmtDollar(iv)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[9px] text-gray-600">
        Current price: {currentPrice ? fmtDollar(currentPrice) : "N/A"} · rows = WACC · cols = terminal growth
      </p>
    </div>
  );
}

// ─── DCF Panel ────────────────────────────────────────────────────────────────

function DcfPanel({
  ticker,
  isGenerated,
  onGenerate,
}: {
  ticker:      string;
  isGenerated: boolean;
  onGenerate:  () => void;
}) {
  const trpc = useTRPC();

  // Assumption state
  const [wacc,            setWacc]            = useState(0.10);
  const [terminalGrowth,  setTerminalGrowth]  = useState(0.025);
  const [fcffGrowthRate,  setFcffGrowthRate]  = useState(0.07);
  const [projectionYears, setProjectionYears] = useState(5);

  // WACC decomposition mode
  const [waccMode, setWaccMode]   = useState<"manual" | "capm">("manual");
  const [rfr,      setRfr]        = useState(0.045);
  const [beta,     setBeta]       = useState(1.0);
  const [erp,      setErp]        = useState(0.05);
  const [cod,      setCod]        = useState(0.05);
  const [dWeight,  setDWeight]    = useState(0.20);

  const [showSensitivity, setShowSensitivity] = useState(false);
  const [lastTicker, setLastTicker] = useState(ticker);

  // Sync suggestions when ticker changes (after first data load)
  const [suggsSynced, setSuggsSynced] = useState<Set<string>>(new Set());

  if (ticker !== lastTicker) {
    setLastTicker(ticker);
    setShowSensitivity(false);
  }

  // CAPM-derived WACC (read from dcf data for tax rate if available)
  const capmWacc = (() => {
    const coe     = rfr + beta * erp;
    const atCod   = cod * 0.75; // default 25% tax; refined below once data loads
    return coe * (1 - dWeight) + atCod * dWeight;
  })();
  const effectiveWacc = waccMode === "capm" ? capmWacc : wacc;

  const assumptions = { wacc: effectiveWacc, terminalGrowth, fcffGrowthRate, projectionYears };

  const { data: dcf, isLoading, error } = useQuery(
    trpc.valuation.dcf.queryOptions({ ticker, assumptions }, { enabled: isGenerated }),
  );

  const { data: sens } = useQuery(
    trpc.valuation.sensitivity.queryOptions(
      { ticker, assumptions },
      { enabled: isGenerated && showSensitivity },
    ),
  );

  // Sync sliders to suggested values on first data load per ticker
  if (dcf && !suggsSynced.has(ticker)) {
    const s = dcf.suggestedAssumptions;
    setSuggsSynced((prev) => { const n = new Set(prev); n.add(ticker); return n; });
    setWacc(s.wacc);
    setTerminalGrowth(s.terminalGrowth);
    setFcffGrowthRate(s.fcffGrowthRate);
    setProjectionYears(s.projectionYears);
  }

  // Refine CAPM tax rate from historical data
  const taxRateForWacc = dcf?.historicalFcff[0]?.taxRate ?? 0.25;
  const capmWaccRefined = (() => {
    const coe   = rfr + beta * erp;
    const atCod = cod * (1 - taxRateForWacc);
    return coe * (1 - dWeight) + atCod * dWeight;
  })();
  const displayWacc = waccMode === "capm" ? capmWaccRefined : wacc;

  // ── Generate gate
  if (!isGenerated) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10">
          <Zap className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-200">Ready to model {ticker}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Adjust assumptions below then run the DCF. Data from Financial Modeling Prep.
          </p>
        </div>

        {/* Quick assumption preview before generate */}
        <div className="w-full max-w-xs space-y-2.5 rounded-lg border border-gray-800 bg-gray-950 p-4">
          <Slider label="WACC" value={wacc} min={0.04} max={0.25} step={0.005}
            format={(v) => `${(v * 100).toFixed(1)}%`} onChange={setWacc} />
          <Slider label="Terminal growth" value={terminalGrowth} min={0.005} max={0.06} step={0.005}
            format={(v) => `${(v * 100).toFixed(1)}%`} onChange={setTerminalGrowth} />
          <Slider label="FCFF growth (projected)" value={fcffGrowthRate} min={-0.1} max={0.35} step={0.01}
            format={(v) => `${(v * 100).toFixed(0)}%`} onChange={setFcffGrowthRate} />
          <Slider label="Projection years" value={projectionYears} min={1} max={10} step={1}
            format={(v) => `${v}y`} onChange={setProjectionYears} />
        </div>

        <button
          onClick={onGenerate}
          className="flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
        >
          <Zap className="h-4 w-4" />
          Generate DCF for {ticker}
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-400" />
        Fetching financials from FMP…
      </div>
    );
  }

  if (error || !dcf) {
    return <p className="py-4 text-sm text-red-400">Failed to load DCF data. Check console for details.</p>;
  }

  if (dcf.dataSource === "none" || dcf.intrinsicValue === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-8 text-center">
        <p className="text-sm text-gray-400">No financial statements found for {ticker}.</p>
        <p className="mt-1 text-[11px] text-gray-600">FMP may not cover this security or statements haven&apos;t been filed yet.</p>
      </div>
    );
  }

  const upPct   = dcf.upDownside;
  const udColor = updownColor(upPct);
  const udLabel = upPct !== null
    ? `${upPct >= 0 ? "↑" : "↓"} ${Math.abs(upPct).toFixed(1)}% ${upPct >= 0 ? "upside" : "downside"}`
    : "—";

  const sugg = dcf.suggestedAssumptions;

  return (
    <div className="space-y-5">

      {/* ── Header row: title + export ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            DCF Analysis
          </span>
          <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
            {ticker} · FY{dcf.mostRecentYear}
          </span>
        </div>
        <button
          onClick={() => exportToCsv(ticker, dcf, sens)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>

      {/* ── Summary KPI cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Intrinsic Value / Share", value: fmtDollar(dcf.intrinsicValue), color: "text-indigo-300" },
          { label: "Current Market Price",    value: dcf.currentPrice ? fmtDollar(dcf.currentPrice) : "—", color: "text-gray-200" },
          { label: "Up / Downside",           value: udLabel, color: udColor },
          { label: "Enterprise Value",        value: fmtM(dcf.enterpriseValue), color: "text-gray-200" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 p-3">
            <p className="text-[10px] text-gray-500">{label}</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── EV Multiples ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "EV / EBITDA",         value: fmtMultiple(dcf.evToEbitda) },
          { label: "EV / Revenue",         value: fmtMultiple(dcf.evToRevenue) },
          { label: "Price / Earnings",     value: fmtMultiple(dcf.priceToEarnings) },
          { label: "EV / FCFF",            value: fmtMultiple(dcf.evToFcf) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
            <p className="text-[10px] text-gray-600">{label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-gray-300">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Assumptions + Value Bridge ─────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Assumptions panel */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assumptions</h3>
            <div className="flex rounded-lg border border-gray-700 overflow-hidden text-[10px]">
              {(["manual", "capm"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setWaccMode(mode)}
                  className={`px-2.5 py-1 font-medium transition-colors ${
                    waccMode === mode ? "bg-indigo-500/20 text-indigo-300" : "bg-transparent text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {mode === "manual" ? "Manual" : "CAPM Builder"}
                </button>
              ))}
            </div>
          </div>

          {waccMode === "manual" ? (
            <div className="space-y-3">
              <Slider label="WACC (discount rate)" value={wacc} min={0.04} max={0.25} step={0.005}
                format={(v) => `${(v * 100).toFixed(1)}%`}
                hint={`${(sugg.wacc * 100).toFixed(1)}%`}
                onChange={setWacc} />
              <Slider label="Terminal growth rate" value={terminalGrowth} min={0.005} max={0.06} step={0.005}
                format={(v) => `${(v * 100).toFixed(1)}%`}
                hint={`${(sugg.terminalGrowth * 100).toFixed(1)}%`}
                onChange={setTerminalGrowth} />
              <Slider label="FCFF growth rate (projected)" value={fcffGrowthRate} min={-0.1} max={0.35} step={0.01}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                hint={`${(sugg.fcffGrowthRate * 100).toFixed(0)}%`}
                onChange={setFcffGrowthRate} />
              <Slider label="Projection years" value={projectionYears} min={1} max={10} step={1}
                format={(v) => `${v}y`}
                hint={`${sugg.projectionYears}y`}
                onChange={setProjectionYears} />
              <button
                onClick={() => { setWacc(sugg.wacc); setTerminalGrowth(sugg.terminalGrowth); setFcffGrowthRate(sugg.fcffGrowthRate); setProjectionYears(sugg.projectionYears); }}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ← Reset to suggested
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cost of Equity */}
              <div className="space-y-2.5 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Cost of Equity (CAPM)</p>
                <Slider label="Risk-free rate" value={rfr} min={0.01} max={0.08} step={0.001}
                  format={(v) => `${(v * 100).toFixed(1)}%`} onChange={setRfr} />
                <Slider label="Beta" value={beta} min={0.3} max={2.5} step={0.05}
                  format={(v) => `${v.toFixed(2)}x`} onChange={setBeta} />
                <Slider label="Equity risk premium" value={erp} min={0.02} max={0.10} step={0.005}
                  format={(v) => `${(v * 100).toFixed(1)}%`} onChange={setErp} />
                <div className="flex justify-between border-t border-gray-800 pt-2 text-[11px]">
                  <span className="text-gray-500">Cost of Equity</span>
                  <span className="font-semibold text-indigo-300">{((rfr + beta * erp) * 100).toFixed(2)}%</span>
                </div>
              </div>

              {/* Cost of Debt */}
              <div className="space-y-2.5 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Cost of Debt</p>
                <Slider label="Pre-tax cost of debt" value={cod} min={0.02} max={0.12} step={0.005}
                  format={(v) => `${(v * 100).toFixed(1)}%`} onChange={setCod} />
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">Tax rate (from data)</span>
                  <span className="text-gray-400">{(taxRateForWacc * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between border-t border-gray-800 pt-2 text-[11px]">
                  <span className="text-gray-500">After-tax Cost of Debt</span>
                  <span className="font-semibold text-gray-300">{(cod * (1 - taxRateForWacc) * 100).toFixed(2)}%</span>
                </div>
              </div>

              {/* Capital structure */}
              <div className="space-y-2.5 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Capital Structure</p>
                <Slider label="Debt weight D/(D+E)" value={dWeight} min={0} max={0.80} step={0.01}
                  format={(v) => `${(v * 100).toFixed(0)}%`} onChange={setDWeight} />
                <div className="flex justify-between border-t border-gray-800 pt-2 text-[11px]">
                  <span className="text-gray-500">→ WACC</span>
                  <span className="font-bold text-indigo-300">{(capmWaccRefined * 100).toFixed(2)}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Slider label="Terminal growth rate" value={terminalGrowth} min={0.005} max={0.06} step={0.005}
                  format={(v) => `${(v * 100).toFixed(1)}%`} onChange={setTerminalGrowth} />
                <Slider label="FCFF growth rate" value={fcffGrowthRate} min={-0.1} max={0.35} step={0.01}
                  format={(v) => `${(v * 100).toFixed(0)}%`} onChange={setFcffGrowthRate} />
                <Slider label="Projection years" value={projectionYears} min={1} max={10} step={1}
                  format={(v) => `${v}y`} onChange={setProjectionYears} />
              </div>
            </div>
          )}
        </div>

        {/* Value Bridge */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Value Bridge</h3>
          <div className="space-y-1 text-[12px]">
            <div className="flex justify-between text-gray-500">
              <span>PV of projected FCFFs ({projectionYears}y)</span>
              <span className="tabular-nums">{fmtM(dcf.pvOfProjected)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>PV of terminal value</span>
              <span className="tabular-nums">{fmtM(dcf.pvOfTerminal)}</span>
            </div>
            <div className="border-t border-gray-700 pt-1 flex justify-between font-semibold text-gray-200">
              <span>Enterprise value</span>
              <span className="tabular-nums">{fmtM(dcf.enterpriseValue)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Less: Net debt</span>
              <span className={`tabular-nums ${dcf.netDebt > 0 ? "text-red-400/80" : "text-green-400/80"}`}>
                {dcf.netDebt > 0 ? `(${fmtM(dcf.netDebt)})` : `+${fmtM(Math.abs(dcf.netDebt))}`}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-gray-200">
              <span>Equity value</span>
              <span className="tabular-nums">{fmtM(dcf.equityValue)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Shares outstanding</span>
              <span className="tabular-nums">{(dcf.sharesOutstanding / 1e6).toFixed(0)}M</span>
            </div>
            <div className="border-t border-indigo-500/40 pt-2 flex justify-between font-bold text-indigo-300">
              <span>Intrinsic value / share</span>
              <span className="tabular-nums">{fmtDollar(dcf.intrinsicValue)}</span>
            </div>
            {dcf.currentPrice && (
              <div className={`flex justify-between font-semibold text-sm ${udColor}`}>
                <span>vs. market price</span>
                <span className="tabular-nums">{udLabel}</span>
              </div>
            )}
          </div>

          {/* Terminal value % split */}
          <div className="mt-2 space-y-1">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide">EV Composition</p>
            <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
              {dcf.enterpriseValue > 0 && (
                <>
                  <div
                    className="bg-indigo-500/60"
                    style={{ width: `${(dcf.pvOfProjected / dcf.enterpriseValue) * 100}%` }}
                  />
                  <div
                    className="bg-indigo-300/30"
                    style={{ width: `${(dcf.pvOfTerminal / dcf.enterpriseValue) * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex gap-3 text-[9px] text-gray-600">
              <span>
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500/60 align-middle" />
                PV FCFFs {dcf.enterpriseValue > 0 ? `${((dcf.pvOfProjected / dcf.enterpriseValue) * 100).toFixed(0)}%` : ""}
              </span>
              <span>
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-300/30 align-middle" />
                Terminal {dcf.enterpriseValue > 0 ? `${((dcf.pvOfTerminal / dcf.enterpriseValue) * 100).toFixed(0)}%` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Projected FCFFs ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Projected Free Cash Flows (WACC = {(displayWacc * 100).toFixed(1)}% · FCFF growth = {(fcffGrowthRate * 100).toFixed(0)}%)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-800">
                {["Year", "FCFF", "Discount Factor", "PV(FCFF)", "Cumulative PV"].map((h) => (
                  <th key={h} className="pb-1.5 text-right first:text-left font-normal text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dcf.projectedFcff.reduce<{ rows: React.ReactNode[]; cumPv: number }>(
                (acc, row) => {
                  const df  = 1 / Math.pow(1 + effectiveWacc, row.year);
                  const cum = acc.cumPv + row.pv;
                  acc.rows.push(
                    <tr key={row.year} className="border-b border-gray-800/50">
                      <td className="py-1 text-gray-400 font-medium">Y+{row.year}</td>
                      <td className="py-1 text-right tabular-nums text-gray-400">{fmtM(row.fcff)}</td>
                      <td className="py-1 text-right tabular-nums text-gray-600">{df.toFixed(4)}</td>
                      <td className="py-1 text-right tabular-nums text-indigo-400/80">{fmtM(row.pv)}</td>
                      <td className="py-1 text-right tabular-nums text-gray-500">{fmtM(cum)}</td>
                    </tr>,
                  );
                  acc.cumPv = cum;
                  return acc;
                },
                { rows: [], cumPv: 0 },
              ).rows}
              <tr className="border-t border-gray-700">
                <td className="py-1.5 text-gray-500 text-[10px]">Terminal value</td>
                <td className="py-1.5 text-right tabular-nums text-gray-600">{fmtM(dcf.terminalValue)}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-600">{(1 / Math.pow(1 + effectiveWacc, projectionYears)).toFixed(4)}</td>
                <td className="py-1.5 text-right tabular-nums text-indigo-400/80">{fmtM(dcf.pvOfTerminal)}</td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-gray-300">{fmtM(dcf.enterpriseValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Historical Income Statement ────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Historical Income Statement</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-800">
                {["FY", "Revenue", "Gr. Growth", "Gross Profit", "Gross Margin", "EBITDA", "EBIT", "EBIT Margin", "Net Income", "Net Margin", "EPS"].map((h) => (
                  <th key={h} className="pb-1.5 text-right first:text-left font-normal text-gray-600 px-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dcf.historicalFcff.map((row) => (
                <tr key={row.fiscalYear} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                  <td className="py-1.5 text-gray-400 font-semibold px-1">{row.fiscalYear}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-300 px-1">{fmtM(row.revenue)}</td>
                  <td className={`py-1.5 text-right tabular-nums px-1 ${row.revenueGrowth !== null ? (row.revenueGrowth >= 0 ? "text-green-400" : "text-red-400") : "text-gray-600"}`}>
                    {row.revenueGrowth !== null ? fmtPct(row.revenueGrowth) : "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-400 px-1">{fmtM(row.grossProfit)}</td>
                  <td className={`py-1.5 text-right tabular-nums px-1 ${marginColor(row.grossMargin)}`}>
                    {fmtPctNeutral(row.grossMargin)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-400 px-1">{fmtM(row.ebitda)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-400 px-1">{fmtM(row.ebit)}</td>
                  <td className={`py-1.5 text-right tabular-nums px-1 ${marginColor(row.ebitMargin)}`}>
                    {fmtPctNeutral(row.ebitMargin)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-400 px-1">{fmtM(row.netIncome)}</td>
                  <td className={`py-1.5 text-right tabular-nums px-1 ${marginColor(row.netMargin)}`}>
                    {fmtPctNeutral(row.netMargin)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500 px-1">${row.eps.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FCF Bridge ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Free Cash Flow Bridge <span className="normal-case font-normal text-gray-600">EBIT × (1−t) + D&amp;A − CapEx = FCFF</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-800">
                {["FY", "EBIT", "Tax Rate", "NOPAT", "+ D&A", "− CapEx", "= FCFF", "Op. CF", "Free CF", "Net Debt", "Equity"].map((h) => (
                  <th key={h} className="pb-1.5 text-right first:text-left font-normal text-gray-600 px-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dcf.historicalFcff.map((row) => (
                <tr key={row.fiscalYear} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                  <td className="py-1.5 text-gray-400 font-semibold px-1">{row.fiscalYear}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-400 px-1">{fmtM(row.ebit)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500 px-1">{fmtPctNeutral(row.taxRate * 100)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-300 px-1">{fmtM(row.nopat)}</td>
                  <td className="py-1.5 text-right tabular-nums text-green-400/70 px-1">+{fmtM(row.depreciation)}</td>
                  <td className="py-1.5 text-right tabular-nums text-red-400/70 px-1">({fmtM(row.capitalExpenditures)})</td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold px-1 ${row.fcff >= 0 ? "text-indigo-300" : "text-red-400"}`}>
                    {fmtM(row.fcff)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500 px-1">{fmtM(row.operatingCashFlow)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500 px-1">{fmtM(row.freeCashFlow)}</td>
                  <td className={`py-1.5 text-right tabular-nums px-1 ${(row.totalDebt - row.cashAndEquivalents) > 0 ? "text-red-400/70" : "text-green-400/70"}`}>
                    {fmtM(row.totalDebt - row.cashAndEquivalents)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500 px-1">{fmtM(row.totalEquity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sensitivity Grid ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Sensitivity — Intrinsic Value / Share
          </h3>
          <button
            onClick={() => setShowSensitivity(true)}
            className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
              showSensitivity
                ? "bg-indigo-500/20 text-indigo-300"
                : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
            }`}
          >
            {showSensitivity ? "Loaded" : "Load grid"}
          </button>
        </div>
        {sens?.cells && sens.cells.length > 0 ? (
          <SensitivityGrid
            cells={sens.cells}
            waccValues={sens.waccValues}
            tGrowthValues={sens.terminalGrowthValues}
            currentPrice={dcf.currentPrice}
          />
        ) : showSensitivity ? (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <div className="h-3 w-3 animate-spin rounded-full border border-gray-700 border-t-indigo-400" />
            Computing…
          </div>
        ) : (
          <p className="text-[11px] text-gray-600">
            WACC ±2% × terminal growth ±0.5% — click "Load grid" to compute.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ValuationCalculator({
  initialSummary,
  hasFmpKey,
}: {
  initialSummary: PortfolioValuationSummaryDTO[];
  hasFmpKey:      boolean;
}) {
  const [selected, setSelected] = useState<string | null>(
    initialSummary[0]?.ticker ?? null,
  );

  // Persists which tickers have been generated across tab switches.
  // Stored here so DcfPanel remounts don't lose the state.
  const [generatedTickers, setGeneratedTickers] = useState<Set<string>>(new Set());

  if (!hasFmpKey) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-4 text-[12px] text-yellow-300/80">
        Add <code className="font-mono">FMP_API_KEY</code> to your environment to enable DCF analysis.
        Get a free key at{" "}
        <a href="https://financialmodelingprep.com/developer/docs" target="_blank" rel="noopener noreferrer" className="underline">
          financialmodelingprep.com
        </a>
        {" "}(250 req/day free tier). Then restart your dev server.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Portfolio overview table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="border-b border-gray-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-300">Holdings Overview</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">Click a row to open the DCF calculator for that stock</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-600">
                {["Ticker", "Name", "Mkt Value", "Weight", "Intrinsic", "Market", "Up/Down", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialSummary.map((row) => {
                const isActive = row.ticker === selected;
                const udColor  = updownColor(row.upDownside);
                const udLabel  = row.upDownside !== null ? fmtPct(row.upDownside) : "—";
                return (
                  <tr
                    key={row.ticker}
                    onClick={() => setSelected(row.ticker)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                      isActive ? "bg-indigo-500/10" : "hover:bg-gray-800/40"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-blue-400">{row.ticker}</td>
                    <td className="px-4 py-2.5 text-gray-300 max-w-[160px] truncate">{row.name}</td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-400">{fmtDollar(row.marketValue)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-500">{row.portfolioWeight.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 tabular-nums text-indigo-300">
                      {row.intrinsicValue ? fmtDollar(row.intrinsicValue) : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-400">
                      {row.currentPrice ? fmtDollar(row.currentPrice) : "—"}
                    </td>
                    <td className={`px-4 py-2.5 tabular-nums font-medium ${udColor}`}>{udLabel}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                        row.status === "valued"   ? "bg-emerald-500/15 text-emerald-400"
                        : row.status === "no_key" ? "bg-yellow-500/15 text-yellow-400"
                        :                           "bg-gray-800 text-gray-500"
                      }`}>
                        {row.status === "valued" ? "Valued" : row.status === "no_key" ? "No key" : "No data"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticker tabs + DCF panel */}
      {selected && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-300">DCF Analysis</h2>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {initialSummary.map((r) => (
                <button
                  key={r.ticker}
                  onClick={() => setSelected(r.ticker)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    r.ticker === selected
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
                  }`}
                >
                  {r.ticker}
                </button>
              ))}
            </div>
          </div>
          <DcfPanel
            key={selected}
            ticker={selected}
            isGenerated={generatedTickers.has(selected)}
            onGenerate={() =>
              setGeneratedTickers((prev) => { const n = new Set(prev); n.add(selected); return n; })
            }
          />
        </div>
      )}
    </div>
  );
}
