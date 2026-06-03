import { NextRequest, NextResponse } from "next/server";
import { cookieConfig } from "@/config/constants";

const protectedPathPrefixes = ["/profile", "/cart", "/checkout", "/favorites", "/admin"];
const publicApiPaths = [
  "/api/auth/csrf",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/customizer/options",
  "/api/webhooks/stripe"
];
const publicApiPrefixes = ["/api/products"];

const securityHeaders = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};

const isProtectedPath = (pathname: string): boolean =>
  protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix));

const isPublicApi = (pathname: string): boolean =>
  publicApiPaths.includes(pathname) || publicApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const applySecurityHeaders = (response: NextResponse): NextResponse => {
  Object.entries(securityHeaders).forEach(([header, value]) => {
    response.headers.set(header, value);
  });
  return response;
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-rsh-pathname", pathname);
  requestHeaders.set("x-rsh-method", request.method);

  const response = applySecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    })
  );
  response.headers.set("x-request-id", requestId);

  if (!isProtectedPath(pathname) && (!pathname.startsWith("/api/") || isPublicApi(pathname))) {
    return response;
  }

  const token = request.cookies.get(cookieConfig.accessTokenName)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      const unauthorizedResponse = applySecurityHeaders(
        NextResponse.json(
          { success: false, error: { code: "AUTH_ERROR", message: "Требуется авторизация" } },
          { status: 401 }
        )
      );
      unauthorizedResponse.headers.set("x-request-id", requestId);
      return unauthorizedResponse;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const redirectResponse = applySecurityHeaders(NextResponse.redirect(loginUrl));
    redirectResponse.headers.set("x-request-id", requestId);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/favorites/:path*",
    "/admin/:path*",
    "/api/:path*"
  ]
};
