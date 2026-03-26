"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useSession, signOut } from "@pip/auth/client";

export function ProfileSection() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  if (!user) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Account</h2>
      <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        {/* Avatar + identity */}
        <div className="flex items-center gap-4 p-5">
          {user.image ? (
            <img src={user.image} alt={user.name ?? ""} className="h-12 w-12 rounded-full" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
              {(user.name ?? user.email ?? "?")[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-100">{user.name ?? "—"}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
            <p className="mt-1 text-[10px] text-gray-600">Signed in via Google</p>
          </div>
        </div>

        {/* Sign out */}
        <div className="p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}
