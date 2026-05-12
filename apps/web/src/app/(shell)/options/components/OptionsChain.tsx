"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { OptionsChainDTO, OptionContractDTO, HoldingTickerDTO } from "@pip/api";

// ─── Format helpers ───────────────────────────────────────────────────────────

const fmt2   = (n: number) => n.toFixed(2);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

function fmtGreek(n: number, decimals = 4): string {
  return n.toFixed(decimals);
}

/** Returns "$X.XX" or "—" when value is zero (bid/ask = 0 after hours). */
function fmtPrice(n: number, prefix = "$"): string {
  return n > 0 ? `${prefix}${fmt2(n)}` : "—";
}

// ─── Payoff chart (inline SVG) ────────────────────────────────────────────────

function PayoffChart({
  points,
  breakeven,
  spot,
}: {
  points:    Array<{ price: number; payoff: number }>;
  breakeven: number;
  spot:      number;
}) {
  if (points.length === 0) return null;

  const W = 500, H = 120;
  const PAD = { l: 40, r: 16, t: 12, b: 28 };

  const prices  = points.map((p) => p.price);
  const payoffs = points.map((p) => p.payoff);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const minY = Math.min(...payoffs), maxY = Math.max(...payoffs);
  const rangeY = maxY - minY || 1;
  const rangeX = maxP - minP || 1;

  const toX = (price: number)  => PAD.l + ((price - minP) / rangeX) * (W - PAD.l - PAD.r);
  const toY = (payoff: number) => PAD.t + ((maxY - payoff) / rangeY) * (H - PAD.t - PAD.b);

  const zeroY    = toY(0);
  const polyline = points.map((p) => `${toX(p.price)},${toY(p.payoff)}`).join(" ");
  const areaAbove = `${points.map((p) => `${toX(p.price)},${Math.min(toY(p.payoff), zeroY)}`).join(" ")} ${toX(maxP)},${zeroY} ${toX(minP)},${zeroY}`;
  const areaBelow = `${points.map((p) => `${toX(p.price)},${Math.max(toY(p.payoff), zeroY)}`).join(" ")} ${toX(maxP)},${zeroY} ${toX(minP)},${zeroY}`;
  const beX   = toX(breakeven);
  const spotX = toX(spot);
  const yTicks = [minY, 0, maxY].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      <polygon points={areaAbove} fill="rgba(52,211,153,0.12)" />
      <polygon points={areaBelow} fill="rgba(248,113,113,0.12)" />
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="rgba(100,116,139,0.5)" strokeWidth="0.8" strokeDasharray="3,3" />
      <polyline points={polyline} fill="none" stroke="rgba(165,180,252,0.9)" strokeWidth="1.5" strokeLinejoin="round" />
      {beX >= PAD.l && beX <= W - PAD.r && (
        <>
          <line x1={beX} y1={PAD.t} x2={beX} y2={H - PAD.b} stroke="rgba(250,204,21,0.5)" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x={beX + 3} y={PAD.t + 8} fill="rgba(250,204,21,0.7)" fontSize="7">BE ${fmt2(breakeven)}</text>
        </>
      )}
      {spotX >= PAD.l && spotX <= W - PAD.r && (
        <>
          <line x1={spotX} y1={PAD.t} x2={spotX} y2={H - PAD.b} stroke="rgba(148,163,184,0.4)" strokeWidth="0.8" strokeDasharray="4,2" />
          <text x={spotX + 3} y={PAD.t + 16} fill="rgba(148,163,184,0.5)" fontSize="7">Spot</text>
        </>
      )}
      {yTicks.map((v) => (
        <text key={v} x={PAD.l - 3} y={toY(v) + 3} textAnchor="end" fill="rgba(100,116,139,0.8)" fontSize="7">
          {v >= 0 ? `+$${fmt2(v)}` : `-$${fmt2(Math.abs(v))}`}
        </text>
      ))}
      {[minP, (minP + maxP) / 2, maxP].map((v) => (
        <text key={v} x={toX(v)} y={H - 4} textAnchor="middle" fill="rgba(100,116,139,0.7)" fontSize="7">
          ${fmt2(v)}
        </text>
      ))}
    </svg>
  );
}

// ─── Option detail panel ──────────────────────────────────────────────────────

function ContractDetail({
  contract,
  type,
  spot,
  afterHours,
}: {
  contract:   OptionContractDTO;
  type:       "call" | "put";
  spot:       number;
  afterHours: boolean;
}) {
  const trpc = useTRPC();
  const [long, setLong] = useState(true);

  // Use lastPrice when bid/ask unavailable (after hours)
  const premium = contract.midpoint > 0 ? contract.midpoint : contract.lastPrice;

  const { data: payoff } = useQuery(
    trpc.options.payoff.queryOptions({ type, strike: contract.strike, premium, long, spot }),
  );

  return (
    <div className="space-y-4 rounded-xl border border-indigo-500/20 bg-gray-900 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${type === "call" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
          {type.toUpperCase()} ${contract.strike}
        </span>
        <span className="text-xs text-gray-500">{contract.contractSymbol}</span>
        {contract.inTheMoney && (
          <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">ITM</span>
        )}
        {afterHours && (
          <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[9px] text-yellow-400/80">After hours — last prices</span>
        )}
        <div className="ml-auto flex rounded-lg overflow-hidden border border-gray-700">
          <button onClick={() => setLong(true)}
            className={`px-3 py-1 text-[11px] font-medium ${long ? "bg-emerald-500/20 text-emerald-300" : "text-gray-500 hover:text-gray-300"}`}>
            Long
          </button>
          <button onClick={() => setLong(false)}
            className={`px-3 py-1 text-[11px] font-medium ${!long ? "bg-red-500/20 text-red-300" : "text-gray-500 hover:text-gray-300"}`}>
            Short
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: afterHours ? "Bid (closed)" : "Bid",  value: afterHours ? "—" : fmtPrice(contract.bid) },
          { label: afterHours ? "Ask (closed)" : "Ask",  value: afterHours ? "—" : fmtPrice(contract.ask) },
          { label: afterHours ? "Last" : "Mid",          value: `$${fmt2(premium)}` },
          { label: "Mkt IV",   value: contract.marketIV > 0.0001 ? fmtPct(contract.marketIV) : "—" },
          { label: "Calc IV",  value: contract.calcIV   ? fmtPct(contract.calcIV) : "—" },
          { label: "Volume",   value: contract.volume.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-gray-800 bg-gray-950 p-2.5">
            <p className="text-[9px] text-gray-600">{label}</p>
            <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-gray-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Greeks */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Δ Delta", value: fmtGreek(contract.delta),         color: "text-blue-300" },
          { label: "Γ Gamma", value: fmtGreek(contract.gamma),         color: "text-indigo-300" },
          { label: "Θ Theta", value: `$${fmtGreek(contract.theta, 4)}`, color: "text-red-300/80" },
          { label: "V Vega",  value: `$${fmtGreek(contract.vega, 4)}`,  color: "text-emerald-300" },
          { label: "ρ Rho",   value: `$${fmtGreek(contract.rho, 4)}`,   color: "text-gray-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-center">
            <p className="text-[9px] text-gray-600">{label}</p>
            <p className={`mt-0.5 text-xs font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-gray-700">
        Theta = $/day decay · Vega = $/1% IV move · Rho = $/1% rate move · per share (×100 per contract)
      </p>

      {payoff && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-gray-500">Premium: <span className="text-gray-300">${fmt2(premium)}</span></span>
            <span className="text-gray-500">Breakeven: <span className="text-yellow-400">${fmt2(payoff.breakeven)}</span></span>
            <span className="text-gray-500">Max loss: <span className="text-red-400">${fmt2(payoff.maxLoss)}</span></span>
            {payoff.maxProfit !== null && (
              <span className="text-gray-500">Max profit: <span className="text-emerald-400">${fmt2(payoff.maxProfit)}</span></span>
            )}
            {payoff.maxProfit === null && <span className="text-emerald-400 text-[10px]">Unlimited upside</span>}
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
            <PayoffChart points={payoff.points} breakeven={payoff.breakeven} spot={spot} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Options chain table ──────────────────────────────────────────────────────

const VISIBLE_STRIKES = 10; // rows each side of ATM

function ChainTable({
  chain,
  onSelect,
  selected,
}: {
  chain:    OptionsChainDTO;
  onSelect: (contract: OptionContractDTO, type: "call" | "put") => void;
  selected: { symbol: string; type: "call" | "put" } | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const { calls, puts, underlyingPrice: spot } = chain;

  const callMap = new Map(calls.map((c) => [c.strike, c]));
  const putMap  = new Map(puts.map((p) => [p.strike, p]));
  const allStrikes = [...new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)])].sort((a, b) => a - b);

  // ATM index = strike closest to spot
  const atmIdx = allStrikes.reduce(
    (best, s, i) => Math.abs(s - spot) < Math.abs(allStrikes[best]! - spot) ? i : best,
    0,
  );

  const visibleStrikes = showAll
    ? allStrikes
    : allStrikes.slice(
        Math.max(0, atmIdx - VISIBLE_STRIKES),
        Math.min(allStrikes.length, atmIdx + VISIBLE_STRIKES + 1),
      );

  const hiddenAbove = Math.max(0, atmIdx - VISIBLE_STRIKES);
  const hiddenBelow = Math.max(0, allStrikes.length - (atmIdx + VISIBLE_STRIKES + 1));

  // After-hours detection: majority of contracts have bid=0
  const afterHours = calls.filter((c) => c.bid === 0).length > calls.length * 0.6;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-2 py-2 text-right font-normal text-gray-600">OI</th>
              <th className="px-2 py-2 text-right font-normal text-emerald-700">IV</th>
              <th className="px-2 py-2 text-right font-normal text-emerald-700">Δ</th>
              <th className="px-2 py-2 text-right font-normal text-emerald-700">Θ</th>
              <th className="px-2 py-2 text-right font-normal text-gray-600">{afterHours ? "Last" : "Bid"}</th>
              <th className="px-2 py-2 text-right font-normal text-gray-600">{afterHours ? "—" : "Ask"}</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-400 bg-gray-800/30">STRIKE</th>
              <th className="px-2 py-2 text-left font-normal text-gray-600">{afterHours ? "Last" : "Bid"}</th>
              <th className="px-2 py-2 text-left font-normal text-gray-600">{afterHours ? "—" : "Ask"}</th>
              <th className="px-2 py-2 text-left font-normal text-red-700">Δ</th>
              <th className="px-2 py-2 text-left font-normal text-red-700">Θ</th>
              <th className="px-2 py-2 text-left font-normal text-red-700">IV</th>
              <th className="px-2 py-2 text-left font-normal text-gray-600">OI</th>
            </tr>
          </thead>
          <tbody>
            {/* "Show above" row */}
            {!showAll && hiddenAbove > 0 && (
              <tr>
                <td colSpan={13} className="py-1 text-center">
                  <button onClick={() => setShowAll(true)}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
                    ↑ {hiddenAbove} more strikes above (show all)
                  </button>
                </td>
              </tr>
            )}

            {visibleStrikes.map((strike) => {
              const call = callMap.get(strike);
              const put  = putMap.get(strike);
              const isAtm         = strike === allStrikes[atmIdx];
              const callSelected  = selected?.symbol === call?.contractSymbol && selected?.type === "call";
              const putSelected   = selected?.symbol === put?.contractSymbol  && selected?.type === "put";

              // Prices: show last when after hours, otherwise bid/ask
              const callDisplay = afterHours
                ? { left: call ? fmtPrice(call.lastPrice) : "—", right: "—" }
                : { left: call ? fmtPrice(call.bid) : "—", right: call ? fmtPrice(call.ask) : "—" };
              const putDisplay = afterHours
                ? { left: put ? fmtPrice(put.lastPrice) : "—", right: "—" }
                : { left: put ? fmtPrice(put.bid) : "—", right: put ? fmtPrice(put.ask) : "—" };

              return (
                <tr
                  key={strike}
                  className={`border-b border-gray-800/40 ${isAtm ? "bg-indigo-500/8 ring-1 ring-inset ring-indigo-500/20" : ""}`}
                >
                  {/* CALL side */}
                  <td className={`px-2 py-1.5 text-right tabular-nums text-gray-600 ${call?.inTheMoney ? "bg-emerald-500/5" : ""}`}>
                    {call?.openInterest ? (call.openInterest / 1000).toFixed(1) + "K" : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${call?.inTheMoney ? "bg-emerald-500/5 text-emerald-400/80" : "text-gray-500"}`}>
                    {call && (call.calcIV ?? call.marketIV) > 0.001 ? fmtPct(call.calcIV ?? call.marketIV) : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${call?.inTheMoney ? "bg-emerald-500/5 text-emerald-300" : "text-gray-400"}`}>
                    {call ? fmtGreek(call.delta) : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${call?.inTheMoney ? "bg-emerald-500/5" : ""} text-gray-500`}>
                    {call ? fmtGreek(call.theta, 4) : "—"}
                  </td>
                  <td
                    onClick={() => call && onSelect(call, "call")}
                    className={`px-2 py-1.5 text-right tabular-nums cursor-pointer transition-colors ${call?.inTheMoney ? "bg-emerald-500/5" : ""} ${callSelected ? "text-indigo-300 font-semibold" : "text-gray-400 hover:text-gray-200"}`}
                  >
                    {callDisplay.left}
                  </td>
                  <td
                    onClick={() => call && onSelect(call, "call")}
                    className={`px-2 py-1.5 text-right tabular-nums cursor-pointer transition-colors ${call?.inTheMoney ? "bg-emerald-500/5" : ""} ${callSelected ? "text-indigo-300 font-semibold" : "text-gray-300 hover:text-white"}`}
                  >
                    {callDisplay.right}
                  </td>

                  {/* STRIKE */}
                  <td className={`px-3 py-1.5 text-center font-semibold bg-gray-800/30 ${isAtm ? "text-indigo-300" : "text-gray-300"}`}>
                    {isAtm && <span className="mr-1 text-[8px] text-indigo-400">▶</span>}
                    ${fmt2(strike)}
                  </td>

                  {/* PUT side */}
                  <td
                    onClick={() => put && onSelect(put, "put")}
                    className={`px-2 py-1.5 text-left tabular-nums cursor-pointer transition-colors ${put?.inTheMoney ? "bg-red-500/5" : ""} ${putSelected ? "text-indigo-300 font-semibold" : "text-gray-300 hover:text-white"}`}
                  >
                    {putDisplay.left}
                  </td>
                  <td
                    onClick={() => put && onSelect(put, "put")}
                    className={`px-2 py-1.5 text-left tabular-nums cursor-pointer transition-colors ${put?.inTheMoney ? "bg-red-500/5" : ""} ${putSelected ? "text-indigo-300 font-semibold" : "text-gray-400 hover:text-gray-200"}`}
                  >
                    {putDisplay.right}
                  </td>
                  <td className={`px-2 py-1.5 text-left tabular-nums ${put?.inTheMoney ? "bg-red-500/5 text-red-300" : "text-gray-400"}`}>
                    {put ? fmtGreek(put.delta) : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-left tabular-nums ${put?.inTheMoney ? "bg-red-500/5" : ""} text-gray-500`}>
                    {put ? fmtGreek(put.theta, 4) : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-left tabular-nums ${put?.inTheMoney ? "bg-red-500/5 text-red-400/80" : "text-gray-500"}`}>
                    {put && (put.calcIV ?? put.marketIV) > 0.001 ? fmtPct(put.calcIV ?? put.marketIV) : "—"}
                  </td>
                  <td className={`px-2 py-1.5 text-left tabular-nums ${put?.inTheMoney ? "bg-red-500/5" : ""} text-gray-600`}>
                    {put?.openInterest ? (put.openInterest / 1000).toFixed(1) + "K" : "—"}
                  </td>
                </tr>
              );
            })}

            {/* "Show below" row */}
            {!showAll && hiddenBelow > 0 && (
              <tr>
                <td colSpan={13} className="py-1 text-center">
                  <button onClick={() => setShowAll(true)}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
                    ↓ {hiddenBelow} more strikes below (show all)
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAll && (
        <div className="flex justify-center py-2 border-t border-gray-800">
          <button onClick={() => setShowAll(false)} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
            Collapse to ±{VISIBLE_STRIKES} strikes around ATM
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OptionsChain({ initialTickers }: { initialTickers: HoldingTickerDTO[] }) {
  const trpc = useTRPC();

  const [ticker,     setTicker]     = useState<string>(initialTickers[0]?.ticker ?? "AAPL");
  const [expiration, setExpiration] = useState<string | undefined>(undefined);
  const [selected,   setSelected]   = useState<{ contract: OptionContractDTO; type: "call" | "put" } | null>(null);

  const { data: chain, isLoading } = useQuery(
    trpc.options.chain.queryOptions({ ticker, expiration }),
  );

  // Auto-skip same-day / next-day expirations for a cleaner default view.
  // Pick the first expiry with DTE >= 7 if the loaded chain has DTE < 7.
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set());
  if (chain && chain.dte < 7 && !expiration && !autoSelected.has(ticker)) {
    const better = chain.expirationDates.find((d) => {
      const dte = Math.round((new Date(d + "T00:00:00Z").getTime() - Date.now()) / 86_400_000);
      return dte >= 7;
    });
    if (better) {
      setAutoSelected((prev) => { const n = new Set(prev); n.add(ticker); return n; });
      setExpiration(better);
    }
  }

  const resolvedExpiration = chain?.expiration ?? expiration;

  const handleSelect = (contract: OptionContractDTO, type: "call" | "put") => {
    setSelected((prev) =>
      prev?.contract.contractSymbol === contract.contractSymbol && prev?.type === type
        ? null
        : { contract, type },
    );
  };

  const [lastKey, setLastKey] = useState(`${ticker}:${expiration}`);
  const currentKey = `${ticker}:${expiration}`;
  if (currentKey !== lastKey) {
    setLastKey(currentKey);
    setSelected(null);
  }

  // After-hours: majority of loaded calls have bid=0
  const afterHours = chain ? chain.calls.filter((c) => c.bid === 0).length > chain.calls.length * 0.6 : false;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {initialTickers.map((h) => (
            <button
              key={h.ticker}
              onClick={() => { setTicker(h.ticker); setExpiration(undefined); setAutoSelected(new Set()); }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                h.ticker === ticker
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
              }`}
            >
              {h.ticker}
            </button>
          ))}
        </div>

        {chain && chain.expirationDates.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-gray-500">Expiration:</span>
            <select
              value={resolvedExpiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            >
              {chain.expirationDates.map((d) => {
                const dte = Math.round((new Date(d + "T00:00:00Z").getTime() - Date.now()) / 86_400_000);
                return (
                  <option key={d} value={d}>{d} ({dte}d)</option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Status bar */}
      {chain && chain.underlyingPrice > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5 text-[11px]">
          <span className="font-semibold text-gray-200">{chain.ticker}</span>
          <span className="text-gray-500">Spot: <span className="text-gray-200 font-medium">${chain.underlyingPrice.toFixed(2)}</span></span>
          <span className="text-gray-500">Expiry: <span className="text-gray-300">{chain.expiration}</span></span>
          <span className="text-gray-500">DTE: <span className={chain.dte <= 7 ? "text-red-400" : "text-gray-300"}>{chain.dte}d</span></span>
          <span className="text-gray-500">RFR: <span className="text-gray-400">{(chain.riskFreeRate * 100).toFixed(1)}%</span></span>
          {afterHours && (
            <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-[9px] font-medium text-yellow-400/80">
              After hours — showing last prices
            </span>
          )}
          <span className="text-gray-600 ml-auto">
            {chain.calls.length} calls · {chain.puts.length} puts
          </span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-400" />
          Loading options chain…
        </div>
      )}

      {!isLoading && chain && chain.calls.length === 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 text-center">
          <p className="text-gray-400">No options data available for {ticker}.</p>
          <p className="mt-1 text-[11px] text-gray-600">Yahoo Finance may not cover options for this security, or markets are closed.</p>
        </div>
      )}

      {chain && chain.calls.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-4 border-b border-gray-800 px-4 py-2 text-[10px] text-gray-600">
            <span className="text-emerald-600 font-medium">CALLS</span>
            <span className="flex-1 text-center text-gray-600">
              ▶ = ATM · ITM calls highlighted green · ITM puts highlighted red
            </span>
            <span className="text-red-700 font-medium">PUTS</span>
          </div>
          <ChainTable
            chain={chain}
            onSelect={handleSelect}
            selected={selected ? { symbol: selected.contract.contractSymbol, type: selected.type } : null}
          />
        </div>
      )}

      {selected && chain && (
        <ContractDetail
          contract={selected.contract}
          type={selected.type}
          spot={chain.underlyingPrice}
          afterHours={afterHours}
        />
      )}
    </div>
  );
}
