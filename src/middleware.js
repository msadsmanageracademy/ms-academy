import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth;
  const path = req.nextUrl.pathname;

  // Redirect authenticated users away from auth pages
  if (session && (path === "/login" || path === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // All dashboard routes require authentication
  if (!session && path.startsWith("/dashboard")) {
    // Come back to the requested page after logging in
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", path + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // Detail pages are admin-only
  if (
    (/^\/dashboard\/courses\/.+/.test(path) ||
      /^\/dashboard\/classes\/.+/.test(path)) &&
    session?.user?.role !== "admin"
  ) {
    return NextResponse.redirect(
      new URL(
        path.startsWith("/dashboard/courses")
          ? "/dashboard/courses"
          : "/dashboard/classes",
        req.url,
      ),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
