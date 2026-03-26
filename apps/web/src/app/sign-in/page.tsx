import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@pip/auth/server";
import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { SignInButton } from "./SignInButton";

export const metadata = { title: "Sign In — Portfolio Intelligence" };

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-100">Portfolio Intelligence</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
          <Suspense fallback={<div className="h-12 animate-pulse rounded-lg bg-gray-800" />}>
            <SignInButton />
          </Suspense>
        </div>

        <p className="text-center text-xs text-gray-600">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
