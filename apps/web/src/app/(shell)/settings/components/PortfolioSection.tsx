"use client";

import { useState } from "react";
import { Check, Plus, Star, Trash2, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function PortfolioSection() {
  const trpc = useTRPC();
  const qc   = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: portfolios = [], isLoading } = useQuery(trpc.portfolio.list.queryOptions());

  const setDefault = useMutation(
    trpc.portfolio.setDefault.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.portfolio.list.queryKey() }),
    }),
  );

  const create = useMutation(
    trpc.portfolio.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.portfolio.list.queryKey() });
        setNewName("");
        setCreating(false);
      },
    }),
  );

  const del = useMutation(
    trpc.portfolio.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.portfolio.list.queryKey() });
        setDeleting(null);
      },
    }),
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    create.mutate({ name: newName.trim() });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Portfolios</h2>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New portfolio
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Portfolio name"
            maxLength={100}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={create.isPending || !newName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
          </div>
        )}

        {!isLoading && portfolios.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-500">No portfolios yet.</p>
        )}

        {portfolios.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-4">
            {/* Default star */}
            <button
              title={p.isDefault ? "Default portfolio" : "Set as default"}
              disabled={setDefault.isPending}
              onClick={() => !p.isDefault && setDefault.mutate({ portfolioId: p.id })}
              className={`shrink-0 transition-colors ${
                p.isDefault
                  ? "text-yellow-400 cursor-default"
                  : "text-gray-700 hover:text-yellow-400"
              }`}
            >
              <Star className="h-4 w-4" fill={p.isDefault ? "currentColor" : "none"} />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200">{p.name}</p>
              <p className="text-xs text-gray-600">
                {p.currency} · benchmark {p.benchmarkTicker ?? "SPY"}
                {p.isDefault && <span className="ml-2 text-yellow-400/80">default</span>}
              </p>
            </div>

            {/* Delete */}
            {deleting === p.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Delete?</span>
                <button
                  onClick={() => del.mutate({ portfolioId: p.id })}
                  disabled={del.isPending}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes"}
                </button>
                <button
                  onClick={() => setDeleting(null)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleting(p.id)}
                className="shrink-0 text-gray-700 transition-colors hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
