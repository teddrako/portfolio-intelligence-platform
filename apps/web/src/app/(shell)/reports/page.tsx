"use client";

import { useState } from "react";
import {
  Sparkles, ChevronDown, ChevronUp,
  Clock, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { ReportDTO } from "@pip/api";
import { GenerateReportModal } from "./components/GenerateReportModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<string, string> = {
  daily_close:       "Daily Close",
  morning_brief:     "Morning Brief",
  portfolio_summary: "Portfolio Summary",
  risk_preview:      "Risk Preview",
  security_analysis: "Security Analysis",
  custom:            "Custom",
};

const TYPE_COLORS: Record<string, string> = {
  daily_close:       "bg-blue-500/15 text-blue-400",
  morning_brief:     "bg-purple-500/15 text-purple-400",
  portfolio_summary: "bg-green-500/15 text-green-400",
  risk_preview:      "bg-red-500/15 text-red-400",
  security_analysis: "bg-yellow-500/15 text-yellow-400",
  custom:            "bg-gray-700 text-gray-300",
};

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({ report }: { report: ReportDTO }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending:   <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    failed:    <XCircle className="h-3.5 w-3.5 text-red-400" />,
  }[report.status];

  return (
    <article className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-colors hover:border-gray-700">
      <button
        className="w-full flex items-start gap-4 px-5 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">{statusIcon}</div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                TYPE_COLORS[report.type] ?? "bg-gray-700 text-gray-400"
              }`}
            >
              {REPORT_TYPE_LABELS[report.type] ?? report.type}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-600">
              <Clock className="h-3 w-3" />
              {timeAgo(report.createdAt)}
            </span>
          </div>
          <p className="line-clamp-1 text-sm font-medium text-gray-200">{report.title}</p>
          {!expanded && report.content && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
              {report.content.replace(/[#*`]/g, "").slice(0, 200)}
            </p>
          )}
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-gray-600">
          {expanded
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && report.content && (
        <div className="border-t border-gray-800 px-5 py-4">
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
            {report.content}
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const trpc  = useTRPC();
  const [modal, setModal] = useState(false);

  const { data: reports = [], refetch } = useQuery(
    trpc.aiReports.list.queryOptions(),
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Reports</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {reports.length} report{reports.length !== 1 ? "s" : ""} generated
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Sparkles className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Empty state */}
      {reports.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-gray-800 bg-gray-900 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/15">
            <Sparkles className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-300">No reports yet</p>
            <p className="mt-1 text-xs text-gray-600">Generate your first AI portfolio report.</p>
          </div>
          <button
            onClick={() => setModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Generate Report
          </button>
        </div>
      )}

      {/* Report list */}
      {reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}

      <GenerateReportModal
        open={modal}
        onClose={() => setModal(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
