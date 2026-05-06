import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "payvision_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "change-this-secret-in-env";
  return new TextEncoder().encode(secret);
}

async function isAuthenticated(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return { loggedIn: false, role: "" };

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      loggedIn: true,
      role: String(payload?.role || "").toUpperCase(),
    };
  } catch {
    return { loggedIn: false, role: "" };
  }
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  // Browser/devtools probes under .well-known should bypass auth redirects.
  if (pathname.startsWith("/.well-known/")) {
    return NextResponse.next();
  }

  const auth = await isAuthenticated(req);
  const { loggedIn, role } = auth;

  if (pathname === "/login") {
    if (loggedIn) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!loggedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const adminOnlyPrefixes = ["/merchants"];
  if (role === "CLIENT" && adminOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/v1|_next/static|_next/image|favicon\.ico|favicon\.svg|llms\.txt|robots\.txt|sitemap\.xml|\.well-known).*)",
  ],
};
