"use client";

import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { X } from "lucide-react";

type TxnType = "buy" | "sell" | "deposit" | "withdrawal";

interface Props {
  portfolioId: string;
  open: boolean;
  onClose: () => void;
}

const TABS: { value: TxnType; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdraw" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionModal({ portfolioId, open, onClose }: Props) {
  const [tab, setTab] = useState<TxnType>("buy");
  const queryClient = useQueryClient();
  const utils = useTRPC();

  const invalidate = () => {
    void queryClient.invalidateQueries(utils.portfolio.summary.queryFilter());
    void queryClient.invalidateQueries(utils.portfolio.holdings.queryFilter());
    void queryClient.invalidateQueries(utils.portfolio.transactions.queryFilter());
  };

  const buyMutation = useMutation(
    utils.transactions.buy.mutationOptions({ onSuccess: () => { invalidate(); onClose(); } }),
  );
  const sellMutation = useMutation(
    utils.transactions.sell.mutationOptions({ onSuccess: () => { invalidate(); onClose(); } }),
  );
  const depositMutation = useMutation(
    utils.transactions.deposit.mutationOptions({ onSuccess: () => { invalidate(); onClose(); } }),
  );

  const isPending = buyMutation.isPending || sellMutation.isPending || depositMutation.isPending;
  const error = buyMutation.error ?? sellMutation.error ?? depositMutation.error;

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => fd.get(k) as string;

    if (tab === "buy") {
      buyMutation.mutate({
        portfolioId,
        ticker: get("ticker").toUpperCase(),
        shares: Number(get("shares")),
        price: Number(get("price")),
        date: get("date"),
        fees: Number(get("fees") || "0"),
        notes: get("notes") || undefined,
      });
    } else if (tab === "sell") {
      sellMutation.mutate({
        portfolioId,
        ticker: get("ticker").toUpperCase(),
        shares: Number(get("shares")),
        price: Number(get("price")),
        date: get("date"),
        fees: Number(get("fees") || "0"),
        notes: get("notes") || undefined,
      });
    } else {
      depositMutation.mutate({
        portfolioId,
        amount: Number(get("amount")),
        date: get("date"),
        type: tab,
        notes: get("notes") || undefined,
      });
    }
  }

  const isCash = tab === "deposit" || tab === "withdrawal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-100">Add Transaction</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-5 gap-1 pt-3">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={[
                "px-3 py-1.5 text-sm rounded-t transition-colors",
                tab === t.value
                  ? "text-blue-400 border-b-2 border-blue-500 font-medium"
                  : "text-gray-500 hover:text-gray-300",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isCash && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ticker" name="ticker" placeholder="e.g. AAPL" required />
              <Field label="Shares" name="shares" type="number" placeholder="0" required min="0.00000001" step="any" />
            </div>
          )}

          {!isCash && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price / Share ($)" name="price" type="number" placeholder="0.00" required min="0.01" step="any" />
              <Field label="Fees ($)" name="fees" type="number" placeholder="0.00" min="0" step="any" />
            </div>
          )}

          {isCash && (
            <Field label="Amount ($)" name="amount" type="number" placeholder="0.00" required min="0.01" step="any" />
          )}

          <Field label="Date" name="date" type="date" required defaultValue={today()} />
          <Field label="Notes (optional)" name="notes" placeholder="e.g. Q4 earnings play" />

          {error && (
            <p className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error.message}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : tab === "buy" ? "Record Buy" : tab === "sell" ? "Record Sell" : tab === "deposit" ? "Record Deposit" : "Record Withdrawal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tiny field component ─────────────────────────────────────────────────────

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

function Field({ label, name, ...props }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...props}
        className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
      />
    </div>
  );
}
