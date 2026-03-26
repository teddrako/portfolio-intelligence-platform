"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TransactionModal } from "./TransactionModal";

export function AddTransactionButton({ portfolioId }: { portfolioId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        <Plus className="h-4 w-4" />
        Add Transaction
      </button>
      <TransactionModal portfolioId={portfolioId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
