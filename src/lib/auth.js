import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import clientPromise from "@/lib/db";
import { compare } from "bcryptjs";

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

        return {
          id: user._id,
          first_name: user.first_name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Acá decido qué guardo en el token, que luego puedo recuperar en la sesión
      if (user) {
        token.id = user.id;
        token.first_name = user.first_name;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      // Acá decido qué guardo en la sesión, proveniente del token
      if (token) {
        session.user.id = token.id;
        session.user.first_name = token.first_name;
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/account",
  },
};
