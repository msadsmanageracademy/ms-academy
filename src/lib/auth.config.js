// Edge-safe auth configuration — no Node.js-only imports (no MongoDB, no bcryptjs)
// Used by middleware to validate JWT tokens without touching the database.

export const authConfig = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login", // Auth errors (e.g. AccessDenied) land on the login page with ?error=
  },
  providers: [],
  callbacks: {
    async jwt({ token, trigger, session }) {
      if (trigger === "update" && session?.name) {
        return { ...token, name: session.name };
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        name: token.name || null,
        id: token.id || null,
        email: token.email || null,
        image: token.image || null,
        role: token.role,
        hasAuthorizedCalendar: token.hasAuthorizedCalendar || false,
      };
      return session;
    },
  },
};
