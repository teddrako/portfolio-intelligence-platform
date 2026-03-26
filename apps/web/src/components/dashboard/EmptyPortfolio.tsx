"use client";

import { TrendingUp } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useRouter } from "next/navigation";

export function EmptyPortfolio() {
  const router = useRouter();
  const utils = useTRPC();
  const create = useMutation(
    utils.portfolio.create.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/15">
        <TrendingUp className="h-7 w-7 text-blue-400" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-100">No portfolio yet</h2>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500">
        Create your first portfolio to start tracking holdings, positions, and performance.
      </p>
      <button
        onClick={() => create.mutate({ name: "Main Portfolio", benchmarkTicker: "SPY" })}
        disabled={create.isPending}
        className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        {create.isPending ? "Creating…" : "Create Portfolio"}
      </button>
    </div>
  );
}
