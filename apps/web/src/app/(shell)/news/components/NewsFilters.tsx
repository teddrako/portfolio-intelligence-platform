"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { key: "all",       label: "All News" },
  { key: "holdings",  label: "My Holdings" },
  { key: "macro",     label: "Macro" },
  { key: "earnings",  label: "Earnings" },
  { key: "policy",    label: "Policy" },
  { key: "rates",     label: "Rates" },
];

const IMPORTANCE_FILTERS = [
  { key: "all",    label: "All" },
  { key: "high",   label: "High" },
  { key: "medium", label: "Medium" },
];

export function NewsFilters() {
  const router     = useRouter();
  const params     = useSearchParams();
  const activeTab  = params.get("tab") ?? "all";
  const activeImp  = params.get("importance") ?? "all";

  function navigate(updates: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "all") next.delete(k);
      else next.set(k, v);
    }
    router.push(`/news?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Category tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => navigate({ tab: key })}
            className={[
              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === key
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-100",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Importance filter */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
        {IMPORTANCE_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => navigate({ importance: key })}
            className={[
              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
              activeImp === key
                ? "bg-gray-700 text-gray-100"
                : "text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
