"use client";

import { useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { signOut, useSession } from "@pip/auth/client";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/holdings",  icon: BarChart3,        label: "Holdings"     },
  { href: "/news",      icon: Newspaper,        label: "Intelligence" },
  { href: "/calendar",  icon: Calendar,         label: "Calendar"     },
  { href: "/reports",   icon: Sparkles,         label: "AI Reports"   },
] as const;

// ─── Shared glass module surface ─────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background:   "linear-gradient(160deg, rgba(14,16,30,0.97) 0%, rgba(9,11,20,0.95) 100%)",
  border:       "1px solid rgba(255,255,255,0.07)",
  boxShadow:    "0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
};

// ─── Label reveal wrapper ─────────────────────────────────────────────────────

function Label({
  children,
  expanded,
  className = "",
}: {
  children: React.ReactNode;
  expanded: boolean;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden whitespace-nowrap ${className}`}
      style={{
        maxWidth:   expanded ? "160px"  : "0px",
        opacity:    expanded ? 1        : 0,
        transform:  expanded ? "none"   : "translateX(-6px)",
        transition: [
          "max-width 240ms cubic-bezier(0.4,0,0.2,1)",
          "opacity   200ms ease",
          "transform 200ms ease",
        ].join(", "),
        transitionDelay: expanded ? "55ms" : "0ms",
      }}
    >
      {children}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { data: session } = useSession();

  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    timer.current = setTimeout(() => setExpanded(true), 130);
  }, []);

  const handleLeave = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setExpanded(false);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="fixed left-3 top-4 bottom-4 z-50 flex flex-col gap-2"
      style={{
        width:      expanded ? "216px" : "48px",
        transition: "width 280ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 1 — IDENTITY
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 overflow-hidden rounded-[18px]" style={GLASS}>
        <div className="flex h-[52px] items-center overflow-hidden px-3 gap-3">

          {/* Brand mark — always visible, diamond reticle */}
          <div className="relative shrink-0">
            <div
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.08) 100%)",
                border:     "1px solid rgba(99,102,241,0.35)",
                boxShadow:  "0 0 10px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {/* Diamond reticle mark */}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                <path
                  d="M6.5 0.75L12.25 6.5L6.5 12.25L0.75 6.5L6.5 0.75Z"
                  stroke="rgba(165,180,252,0.75)"
                  strokeWidth="0.9"
                />
                <path
                  d="M6.5 3.75L9.25 6.5L6.5 9.25L3.75 6.5L6.5 3.75Z"
                  fill="rgba(165,180,252,0.55)"
                />
                {/* Corner ticks */}
                <line x1="6.5" y1="0"   x2="6.5" y2="1.8"  stroke="rgba(165,180,252,0.3)" strokeWidth="0.7"/>
                <line x1="6.5" y1="11.2" x2="6.5" y2="13" stroke="rgba(165,180,252,0.3)" strokeWidth="0.7"/>
              </svg>
            </div>
            {/* Live pulse dot */}
            <span
              className="absolute -top-0.5 -right-0.5 h-[7px] w-[7px] rounded-full bg-emerald-400 animate-pulse-dot"
              style={{ boxShadow: "0 0 5px rgba(52,211,153,0.7)" }}
            />
          </div>

          {/* Brand text — revealed on expand */}
          <Label expanded={expanded}>
            <div className="leading-none">
              <p className="text-[12px] font-semibold tracking-tight text-slate-100">
                Portfolio{" "}
                <span
                  style={{
                    background: "linear-gradient(90deg, #818CF8, #a5b4fc)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Intel
                </span>
              </p>
              <div className="mt-[3px] flex items-center gap-1">
                <span
                  className="h-1 w-1 rounded-full bg-emerald-400"
                  style={{ boxShadow: "0 0 3px rgba(52,211,153,0.8)" }}
                />
                <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-emerald-400/60">
                  Live
                </span>
              </div>
            </div>
          </Label>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 2 — NAVIGATION
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-[18px] p-[5px] gap-[3px]" style={GLASS}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className="group relative flex items-center overflow-hidden rounded-[13px] transition-colors duration-150"
              style={{
                height:     "38px",
                background: active
                  ? "linear-gradient(135deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.28) 100%)"
                  : "transparent",
                boxShadow: active
                  ? "inset 0 1px 3px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)"
                  : undefined,
              }}
            >
              {/* Icon chip — always visible */}
              <div className="flex shrink-0 items-center justify-center" style={{ width: "38px", height: "38px" }}>
                <div
                  className="flex items-center justify-center rounded-[9px] transition-all duration-150"
                  style={{
                    width:      "26px",
                    height:     "26px",
                    background: active ? "rgba(99,102,241,0.14)" : "transparent",
                    border:     active
                      ? "1px solid rgba(99,102,241,0.28)"
                      : "1px solid transparent",
                    boxShadow:  active ? "inset 0 1px 0 rgba(255,255,255,0.07)" : "none",
                  }}
                >
                  <Icon
                    style={{
                      width:  "13px",
                      height: "13px",
                      color:  active
                        ? "rgba(165,180,252,1)"
                        : "rgba(80,90,112,1)",
                      transition: "color 150ms ease",
                    }}
                  />
                </div>
              </div>

              {/* Label — revealed on expand */}
              <Label expanded={expanded}>
                <span
                  className="text-[12.5px] font-medium"
                  style={{
                    color: active ? "rgba(220,225,255,1)" : "rgba(100,110,135,1)",
                    transition: "color 150ms ease",
                  }}
                >
                  {label}
                </span>
              </Label>

              {/* Active indicator bar — right edge */}
              {active && (
                <div
                  className="absolute right-[5px] top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width:      "2px",
                    height:     "16px",
                    background: "linear-gradient(180deg, rgba(165,180,252,0.7) 0%, rgba(99,102,241,0.4) 100%)",
                    boxShadow:  "0 0 4px rgba(99,102,241,0.4)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODULE 3 — PROFILE / SETTINGS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 overflow-hidden rounded-[18px]" style={GLASS}>
        <div className="flex flex-col gap-[3px] p-[5px]">

          {/* Settings */}
          <Link
            href="/settings"
            className="flex items-center overflow-hidden rounded-[13px] transition-colors duration-150"
            style={{
              height:     "36px",
              background: pathname.startsWith("/settings")
                ? "rgba(0,0,0,0.3)"
                : "transparent",
            }}
          >
            <div className="flex shrink-0 items-center justify-center" style={{ width: "38px" }}>
              <Settings
                style={{ width: "13px", height: "13px", color: "rgba(70,80,100,1)" }}
              />
            </div>
            <Label expanded={expanded}>
              <span className="text-[12px] font-medium text-slate-600">Settings</span>
            </Label>
          </Link>

          {/* User row */}
          {session?.user && (
            <div className="flex items-center overflow-hidden rounded-[13px]" style={{ height: "36px" }}>
              {/* Avatar */}
              <div className="flex shrink-0 items-center justify-center" style={{ width: "38px" }}>
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-[18px] w-[18px] rounded-full"
                    style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
                  />
                ) : (
                  <div
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.6), rgba(79,70,229,0.8))" }}
                  >
                    {(session.user.name ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + sign out */}
              <Label expanded={expanded} className="flex flex-1 items-center justify-between pr-2">
                <span className="truncate text-[11px] text-slate-600 max-w-[90px]">
                  {session.user.name ?? session.user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="ml-1 shrink-0 rounded-md p-0.5 text-slate-700 transition-colors hover:text-rose-400"
                >
                  <LogOut style={{ width: "10px", height: "10px" }} />
                </button>
              </Label>
            </div>
          )}

        </div>
      </div>

    </aside>
  );
}
