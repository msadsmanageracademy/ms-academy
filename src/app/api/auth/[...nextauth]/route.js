import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import clientPromise from "@/lib/db";
import { compare } from "bcryptjs";
import NextAuth from "next-auth";

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
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
        if (!isValid) throw new Error("Contraseña incorrecta");

        return { id: user._id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/profile",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
