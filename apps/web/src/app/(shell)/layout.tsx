import { Sidebar } from "@/components/layout/Sidebar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Ambient mesh background — fixed, behind everything */}
      <div className="pointer-events-none fixed inset-0 bg-mesh" aria-hidden />

      <Sidebar />

      <main className="relative flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
