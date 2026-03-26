import { Sidebar } from "@/components/layout/Sidebar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Ambient mesh — fixed, behind everything */}
      <div className="pointer-events-none fixed inset-0 bg-mesh" aria-hidden />

      {/* Floating sidebar — fixed, hovers above content */}
      <Sidebar />

      {/*
        Main content — offset by the collapsed sidebar width:
        12px (left gap) + 48px (collapsed width) + 12px (breathing room) = 72px
        The sidebar expands as an overlay, so this margin never changes.
      */}
      <main className="relative min-h-screen overflow-y-auto" style={{ marginLeft: "72px" }}>
        {children}
      </main>
    </div>
  );
}
