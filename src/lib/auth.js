import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { ObjectId } from "mongodb";
import { authConfig } from "./auth.config";
import clientPromise from "@/lib/db";
import { compare } from "bcryptjs";
import { config } from "@/config";
import NextAuth, { CredentialsSignin } from "next-auth";
import {
  getClientIp,
  hitRateLimit,
  peekRateLimit,
  resetRateLimit,
} from "@/lib/rateLimit";

const DEFAULT_ROLE = "user";

const LOGIN_LIMITS = {
  account: { scope: "login-account", limit: 5, windowSec: 15 * 60 }, // per IP + email
  ip: { scope: "login-ip", limit: 20, windowSec: 15 * 60 }, // per IP
};

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

async function getUsersCollection() {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB_NAME).collection("users");
}

const emailQuery = (email) => ({
  email: { $in: [...new Set([email, email.toLowerCase()])] },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        // Brute-force protection: only failed attempts count
        const ip = getClientIp(request?.headers);
        const accountKey = { ...LOGIN_LIMITS.account, key: `${ip}|${email.toLowerCase()}` };
        const ipKey = { ...LOGIN_LIMITS.ip, key: ip };
        const [accountFails, ipFails] = await Promise.all([
          peekRateLimit(accountKey),
          peekRateLimit(ipKey),
        ]);
        if (accountFails >= accountKey.limit || ipFails >= ipKey.limit) {
          throw new RateLimitedSignin();
        }
        const fail = async () => {
          await Promise.all([hitRateLimit(accountKey), hitRateLimit(ipKey)]);
          return null;
        };

        const usersCollection = await getUsersCollection();
        const user = await usersCollection.findOne(emailQuery(email));

        // Users created via Google have no password
        if (!user?.password) return fail();

        const isValid = await compare(password, user.password);
        if (!isValid) return fail();

        await resetRateLimit(accountKey);

        return {
          name: user.first_name,
          id: user._id.toString(),
          email: user.email,
          role: user.role ?? DEFAULT_ROLE,
          hasAuthorizedCalendar: user.hasAuthorizedCalendar || false,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Links a Google sign-in to an existing user with the same email (e.g. created
      // with credentials, or Google users created before the adapter stored accounts).
      // Safe because Google verifies email ownership; unverified emails are rejected
      // in the signIn callback below.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        url: "https://accounts.google.com/o/oauth2/auth",
        params: {
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile",
        },
      },
    }),
  ],
  events: {
    // Users created by the adapter (Google sign-up) don't get a role by default
    async createUser({ user }) {
      if (!user?.id) return;
      const usersCollection = await getUsersCollection();
      await usersCollection.updateOne(
        { _id: new ObjectId(user.id), role: { $exists: false } },
        { $set: { role: DEFAULT_ROLE, createdAt: new Date(), updatedAt: new Date() } },
      );
    },
  },
  callbacks: {
    // Google sign-in must respect the `allowRegistration` flag for new accounts
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      // Account linking by email is only safe for verified Google emails
      if (profile?.email_verified === false) return false;
      if (config.allowRegistration) return true;
      if (!user?.email) return false;

      const usersCollection = await getUsersCollection();
      const existingUser = await usersCollection.findOne(emailQuery(user.email), {
        projection: { _id: 1 },
      });
      return existingUser ? true : "/login?error=registration_disabled";
    },
    async jwt({ token, trigger, session, user, account }) {
      if (trigger === "update" && session?.name) {
        return { ...token, name: session.name };
      }

      if (user && account?.provider === "credentials") {
        return {
          name: user.name,
          id: user.id,
          email: user.email,
          role: user.role,
          hasAuthorizedCalendar: user.hasAuthorizedCalendar || false,
        };
      }

      if (user && account?.provider === "google") {
        const usersCollection = await getUsersCollection();

        let existingUser = await usersCollection.findOne(emailQuery(user.email));

        if (!existingUser) {
          const newUser = {
            email: user.email,
            image: user.image,
            role: DEFAULT_ROLE,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const result = await usersCollection.insertOne(newUser);
          existingUser = { ...newUser, _id: result.insertedId };
        }

        // Backfill missing role / image on existing records
        const backfill = {};
        if (!existingUser.role) backfill.role = DEFAULT_ROLE;
        if (!existingUser.image && user.image) backfill.image = user.image;
        if (Object.keys(backfill).length > 0) {
          await usersCollection.updateOne(
            { _id: existingUser._id },
            { $set: backfill },
          );
        }

        return {
          name: existingUser.first_name,
          id: existingUser._id.toString(),
          email: existingUser.email,
          image: user.image,
          role: existingUser.role ?? DEFAULT_ROLE,
          hasAuthorizedCalendar: existingUser.hasAuthorizedCalendar || false,
        };
      }

      return token;
    },
    async session({ session, token }) {
      let hasAuthorizedCalendar = token.hasAuthorizedCalendar || false;

      if (token.id) {
        try {
          const usersCollection = await getUsersCollection();
          const user = await usersCollection.findOne(
            { _id: new ObjectId(token.id) },
            { projection: { hasAuthorizedCalendar: 1 } },
          );
          if (user) hasAuthorizedCalendar = user.hasAuthorizedCalendar || false;
        } catch (error) {
          console.error("Error fetching calendar authorization status:", error);
        }
      }

      session.user = {
        name: token.name || null,
        id: token.id || null,
        email: token.email || null,
        image: token.image || null,
        role: token.role,
        hasAuthorizedCalendar,
      };

      return session;
    },
  },
});
