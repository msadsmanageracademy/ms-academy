import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  console.log("Middleware is running");
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Si no hay token y la ruta es protegida, redirigir al login
  if (!token) {
    const loginUrl = new URL("/auth/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const protectedRoutes = ["/dashboard"]; // Tanto role="admin" como role="user" podrán acceder
  const adminRoutes = ["/dashboard/create-events", "/dashboard/edit-events"]; // Solo role="admin" podrá acceder
  const userRoutes = ["/dashboard/my-classes"]; // Solo role="user" podrá acceder

  const path = req.nextUrl.pathname;

  // Si no hay token y la ruta es protegida, redirigir al login
  if (protectedRoutes.some((route) => path.startsWith(route)) && !token) {
    const loginUrl = new URL("/auth/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (adminRoutes.includes(path) && token?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (userRoutes.includes(path) && token?.role !== "user") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

// Aplicar middleware solo a rutas dentro de /dashboard
export const config = {
  matcher: ["/dashboard/:path*"],
};
