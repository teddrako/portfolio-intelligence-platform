"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Calendar,
  FileText,
  LogOut,
  Newspaper,
  Settings,
  TrendingUp,
} from "lucide-react";
import { signOut, useSession } from "@pip/auth/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/holdings",  label: "Holdings",  icon: Briefcase },
  { href: "/news",      label: "News",      icon: Newspaper },
  { href: "/calendar",  label: "Calendar",  icon: Calendar },
  { href: "/reports",   label: "Reports",   icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <aside className="flex w-56 flex-col border-r border-gray-800 bg-gray-900">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-gray-800 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-100">Portfolio Intel</p>
          <p className="text-[10px] text-gray-500">Market Intelligence</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-blue-600/15 text-blue-400 font-medium"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 p-2 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100"
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        {/* User info + logout */}
        {session?.user && (
          <div className="mt-1 rounded-md border border-gray-800 bg-gray-950/50 px-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                  {(session.user.name ?? session.user.email ?? "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-200">
                  {session.user.name ?? "User"}
                </p>
                <p className="truncate text-[10px] text-gray-500">
                  {session.user.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
            >
              <LogOut className="h-3 w-3 shrink-0" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
