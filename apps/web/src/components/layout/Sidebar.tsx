"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Newspaper,
  Calendar,
  Sparkles,
  Settings,
  LogOut,
  Activity,
} from "lucide-react";
import { signOut, useSession } from "@pip/auth/client";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/holdings",  icon: BarChart3,        label: "Holdings" },
  { href: "/news",      icon: Newspaper,        label: "Intelligence" },
  { href: "/calendar",  icon: Calendar,         label: "Calendar" },
  { href: "/reports",   icon: Sparkles,         label: "AI Reports" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <aside
      className="glass-blur relative z-20 flex w-56 shrink-0 flex-col"
      style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* ── Logo ── */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: "rgba(99,102,241,0.18)",
            border: "1px solid rgba(99,102,241,0.3)",
            boxShadow: "0 0 12px rgba(99,102,241,0.2)",
          }}
        >
          <Activity className="h-3.5 w-3.5 text-indigo-400" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-tight text-slate-100">
            Portfolio <span className="text-indigo-400">Intel</span>
          </p>
          <p className="text-[9px] uppercase tracking-widest text-slate-600">
            AI-native
          </p>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 space-y-px px-2.5 py-1">
        <p className="overline mb-3 px-2 pt-2">Navigation</p>

        {NAV.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={[
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-200",
              ].join(" ")}
              style={
                active
                  ? {
                      background: "rgba(255,255,255,0.07)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 3px rgba(0,0,0,0.2)",
                    }
                  : undefined
              }
            >
              <Icon
                className={[
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-indigo-400"
                    : "text-slate-600 group-hover:text-slate-400",
                ].join(" ")}
              />
              {label}
              {active && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse-dot"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div
        className="space-y-px px-2.5 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Link
          href="/settings"
          className={[
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
            pathname.startsWith("/settings")
              ? "bg-white/[0.07] text-white"
              : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
          ].join(" ")}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        {session?.user && (
          <div
            className="mt-1 rounded-xl px-3 py-2.5"
            style={{
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-center gap-2.5">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  className="h-6 w-6 rounded-full ring-1 ring-white/10"
                />
              ) : (
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "rgba(99,102,241,0.5)" }}
                >
                  {(session.user.name ?? session.user.email ?? "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-slate-300">
                  {session.user.name ?? "User"}
                </p>
                <p className="truncate text-[9px] text-slate-600">
                  {session.user.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-lg p-1 text-slate-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
