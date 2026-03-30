"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@pip/auth/client";

// ─── Google SVG ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 outline-none transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = "1px solid rgba(99,102,241,0.5)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-white/[0.06]" />
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-700">or</span>
      <div className="flex-1 border-t border-white/[0.06]" />
    </div>
  );
}

// ─── Sign Up Form ─────────────────────────────────────────────────────────────

export function SignUpForm() {
  const router = useRouter();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState<"email" | "google" | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading("email");
    const { error: err } = await signUp.email({ name, email, password, callbackURL: "/dashboard" });
    if (err) {
      setError(err.message ?? "Could not create account. Please try again.");
      setLoading(null);
    } else {
      // autoSignIn: true means we're already signed in — go straight to dashboard
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    await signIn.social({ provider: "google", callbackURL: "/dashboard" });
  }

  return (
    <div className="space-y-4">

      {/* Fields */}
      <form onSubmit={handleSignUp} className="space-y-3">
        <Field label="Name" type="text" value={name} onChange={setName}
          placeholder="Your name" autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail}
          placeholder="you@example.com" autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword}
          placeholder="Min. 8 characters" autoComplete="new-password" />

        {error && (
          <p className="rounded-lg px-3 py-2 text-[12px] text-rose-400"
            style={{ background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.15)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!!loading}
          className="w-full rounded-lg py-2.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.9), rgba(79,70,229,0.9))",
            boxShadow: "0 2px 12px rgba(99,102,241,0.3)",
          }}
        >
          {loading === "email" ? "Creating account…" : "Create account"}
        </button>
      </form>

      <Divider />

      {/* Google */}
      <button
        onClick={handleGoogle}
        disabled={!!loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg py-2.5 text-[13px] font-medium text-slate-200 transition-colors disabled:opacity-50"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      >
        <GoogleIcon />
        {loading === "google" ? "Redirecting…" : "Continue with Google"}
      </button>

      {/* Switch to sign-in */}
      <p className="text-center text-[12px] text-slate-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-indigo-400 hover:text-indigo-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
