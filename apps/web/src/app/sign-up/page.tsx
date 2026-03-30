import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@pip/auth/server";
import { Suspense } from "react";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: "Create Account — Portfolio Intelligence" };

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(79,70,229,0.5))",
              border: "1px solid rgba(99,102,241,0.4)",
              boxShadow: "0 0 20px rgba(99,102,241,0.2)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path d="M6.5 0.75L12.25 6.5L6.5 12.25L0.75 6.5L6.5 0.75Z" stroke="rgba(165,180,252,0.8)" strokeWidth="0.9" />
              <path d="M6.5 3.75L9.25 6.5L6.5 9.25L3.75 6.5L6.5 3.75Z" fill="rgba(165,180,252,0.6)" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-[17px] font-semibold text-slate-100">Create your account</h1>
            <p className="mt-1 text-[13px] text-slate-500">Start tracking your portfolio</p>
          </div>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "linear-gradient(160deg, rgba(14,16,30,0.97) 0%, rgba(9,11,20,0.95) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-white/5" />}>
            <SignUpForm />
          </Suspense>
        </div>

        <p className="text-center text-[11px] text-slate-700">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
