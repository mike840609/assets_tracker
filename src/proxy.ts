import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPublicRoute = ["/login", "/privacy"].includes(req.nextUrl.pathname);

  if (!isLoggedIn && !isPublicRoute) {
    const newUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  if (isLoggedIn && req.nextUrl.pathname === "/login") {
    const newUrl = new URL("/", req.nextUrl.origin);
    return Response.redirect(newUrl);
  }

  // On first visit (no locale cookie), detect from Accept-Language and set cookie
  const localeCookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (!localeCookie) {
    const acceptLanguage = req.headers.get("accept-language") ?? "";
    const locale = acceptLanguage.toLowerCase().includes("zh") ? "zh-TW" : "en-US";
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|apple-icon|icon).*)"],
};
