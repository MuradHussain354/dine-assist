import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and login API without authentication
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    // If user is already authenticated and visits /admin/login, redirect to /admin/menu
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const secret = process.env.AUTH_SECRET || "";
    if (token && secret) {
      const { valid } = await verifySessionToken(token, secret);
      if (valid && pathname === "/admin/login") {
        return NextResponse.redirect(new URL("/admin/menu", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET || "";

  let isAuthenticated = false;
  if (token && secret) {
    const { valid } = await verifySessionToken(token, secret);
    isAuthenticated = valid;
  }

  if (!isAuthenticated) {
    // Return 401 for /api/admin/* endpoints
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Redirect to login page for /admin/* pages
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
