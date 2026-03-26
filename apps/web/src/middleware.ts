import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-compatible middleware — reads the session cookie without hitting the DB.
 *
 * DEV BYPASS: Set DEV_USER_ID=user_demo_01 in .env to skip authentication in
 * development. The userId is forwarded as the x-dev-user-id request header so
 * the tRPC route handler and server-side caller can read it.
 */
export function middleware(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  const devHeader = request.headers.get("x-dev-user-id");

  // Dev bypass — only active when NODE_ENV=development AND (DEV_USER_ID is set OR devHeader exists)
  if (
    process.env.NODE_ENV === "development" &&
    (process.env.DEV_USER_ID || devHeader)
  ) {
    const requestHeaders = new Headers(request.headers);
    if (!devHeader && process.env.DEV_USER_ID) {
      requestHeaders.set("x-dev-user-id", process.env.DEV_USER_ID);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!sign-in|login|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
