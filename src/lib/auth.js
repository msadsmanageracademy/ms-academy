import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { compare } from "bcryptjs";
import { authConfig } from "./auth.config";

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
      async authorize(credentials) {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME);
        const usersCollection = db.collection("users");

        const user = await usersCollection.findOne({
          email: credentials.email,
        });
        if (!user) throw new Error("Usuario no encontrado");

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) throw new Error("Contrasena incorrecta");

        return {
          name: user.first_name,
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          hasAuthorizedCalendar: user.hasAuthorizedCalendar || false,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
  callbacks: {
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
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME);
        const usersCollection = db.collection("users");

        let existingUser = await usersCollection.findOne({ email: user.email });

        if (!existingUser) {
          const newUser = {
            email: user.email,
            image: user.image,
            role: "user",
          };
          const result = await usersCollection.insertOne(newUser);
          existingUser = { ...newUser, _id: result.insertedId };
        }

        if (existingUser && !existingUser.image) {
          await usersCollection.updateOne(
            { _id: existingUser._id },
            { $set: { image: user.image } },
          );
        }

        return {
          name: existingUser.first_name,
          id: existingUser._id.toString(),
          email: existingUser.email,
          image: user.image,
          role: existingUser.role,
          googleAccessToken: account.access_token,
          googleScope: account.scope,
          hasAuthorizedCalendar: existingUser.hasAuthorizedCalendar || false,
        };
      }

      return token;
    },
    async session({ session, token }) {
      let hasAuthorizedCalendar = token.hasAuthorizedCalendar || false;

      if (token.id) {
        try {
          const client = await clientPromise;
          const db = client.db(process.env.MONGODB_DB_NAME);
          const usersCollection = db.collection("users");

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
      session.googleAccessToken = token.googleAccessToken || null;
      session.googleScope = token.googleScope || null;

      return session;
    },
  },
});
