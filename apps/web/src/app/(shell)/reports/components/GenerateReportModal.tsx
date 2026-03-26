"use client";

import { useState } from "react";
import { Loader2, X, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

const REPORT_TYPES = [
  { value: "daily_close",       label: "Daily Close Summary",       desc: "What moved today and why" },
  { value: "morning_brief",     label: "Morning Brief",             desc: "Pre-market outlook + catalysts" },
  { value: "portfolio_summary", label: "Portfolio Summary",         desc: "Full overview of your positions" },
  { value: "risk_preview",      label: "Risk Preview",              desc: "Tail risks and stress scenarios" },
  { value: "security_analysis", label: "Security Analysis",         desc: "Deep-dive on a single position" },
  { value: "custom",            label: "Custom",                    desc: "Write your own prompt" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["value"];

interface Props {
  open:     boolean;
  onClose:  () => void;
  onSuccess: () => void;
}

export function GenerateReportModal({ open, onClose, onSuccess }: Props) {
  const trpc        = useTRPC();
  const qc          = useQueryClient();
  const [type,   setType]   = useState<ReportType>("portfolio_summary");
  const [ticker, setTicker] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error,  setError]  = useState<string | null>(null);

  const generate = useMutation(
    trpc.aiReports.generate.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.aiReports.list.queryKey() });
        onSuccess();
        onClose();
      },
      onError: (err) => setError(err.message),
    }),
  );

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    generate.mutate({
      type,
      ticker: ticker.trim().toUpperCase() || undefined,
      prompt: prompt.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-100">Generate Report</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Report type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">Report type</label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={[
                    "rounded-lg border p-2.5 text-left transition-colors",
                    type === value
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-gray-800 bg-gray-800/50 hover:border-gray-700",
                  ].join(" ")}
                >
                  <p className={`text-xs font-medium ${type === value ? "text-blue-400" : "text-gray-300"}`}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-600 line-clamp-1">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Ticker (for security analysis) */}
          {type === "security_analysis" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Ticker</label>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. NVDA"
                maxLength={10}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Custom prompt */}
          {type === "custom" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like to analyse?"
                rows={3}
                maxLength={2000}
                className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-right text-[10px] text-gray-600">{prompt.length}/2000</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generate.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generate.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Generate</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
