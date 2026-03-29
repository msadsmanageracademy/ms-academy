import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";

const handler = NextAuth(authOptions);

export async function GET(req, ctx) {
  return handler(req, { params: await ctx.params });
}

export async function POST(req, ctx) {
  return handler(req, { params: await ctx.params });
}
