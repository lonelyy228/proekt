import { NextRequest, NextResponse } from "next/server";
import { cookieConfig } from "@/config/constants";

const protectedPathPrefixes = ["/profile", "/cart", "/checkout", "/favorites", "/editor", "/admin"];
const publicApiPaths = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/webhooks/stripe"];

const securityHeaders = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};

const isProtectedPath = (pathname: string): boolean =>
  protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix));

const isPublicApi = (pathname: string): boolean => publicApiPaths.includes(pathname);

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([header, value]) => {
    response.headers.set(header, value);
  });

  if (!isProtectedPath(pathname) && (!pathname.startsWith("/api/") || isPublicApi(pathname))) {
    return response;
  }

  const token = request.cookies.get(cookieConfig.accessTokenName)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_ERROR", message: "Требуется авторизация" } },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/favorites/:path*",
    "/editor/:path*",
    "/admin/:path*",
    "/api/:path*"
  ]
};
