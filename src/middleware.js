import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth;

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const adminRoutes = ["/dashboard/create-events", "/dashboard/edit-events"];
  const userRoutes = ["/dashboard/my-classes"];
  const path = req.nextUrl.pathname;

  if (adminRoutes.includes(path) && session.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (userRoutes.includes(path) && session.user?.role !== "user") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
