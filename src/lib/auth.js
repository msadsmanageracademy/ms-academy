import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import GoogleProvider from "next-auth/providers/google";
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
          name: user.first_name, // Estará si el usuario completó su perfil
          id: user._id,
          email: user.email,
          role: user.role,
          hasAuthorizedCalendar: user.hasAuthorizedCalendar || false,
        };
      },
    }),
    GoogleProvider({
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
      /* Si trigger === "update", quiere decir que utilicé el método update() de next-auth (en el FE)
        El objeto session es lo que paso como parámetro en update() en el FE
        Actualizo la propiedad del token con la información que envío desde FE, esto me permite por ejemplo editar el perfil y actualizar la info de la session */

      if (trigger === "update" && session?.name) {
        const updatedToken = { ...token, name: session.name };

        return updatedToken;
      }

      // Acá decido qué guardo en el token, que luego puedo recuperar en la sesión

      if (user && account?.provider === "credentials") {
        return {
          name: user.first_name, // Estará si el usuario completó su perfil
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }

      // Si el usuario inicia sesión con Google y ya tenía una sesión, fusiono la info
      if (user && account?.provider === "google") {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME);
        const usersCollection = db.collection("users");

        let existingUser = await usersCollection.findOne({
          email: user.email,
        });

        if (!existingUser) {
          const newUser = {
            email: user.email,
            image: user.image,
            role: "user",
          };
          const result = await usersCollection.insertOne(newUser);

          existingUser = { ...newUser, _id: result.insertedId };
        }

        // En caso de loguearse con Google después de haber creado una cuenta regular, actualizo sus datos en la DB para incluir la imagen de Google

        if (existingUser && !existingUser.image) {
          const result = await usersCollection.updateOne(
            { _id: existingUser._id },
            { $set: { image: user.image } }
          );
          if (!result) throw new Error("Usuario no encontrado");
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
      // Fetch fresh hasAuthorizedCalendar status from database
      let hasAuthorizedCalendar = token.hasAuthorizedCalendar || false;

      if (token.id) {
        try {
          const client = await clientPromise;
          const db = client.db(process.env.MONGODB_DB_NAME);
          const usersCollection = db.collection("users");
          const { ObjectId } = require("mongodb");

          const user = await usersCollection.findOne(
            { _id: new ObjectId(token.id) },
            { projection: { hasAuthorizedCalendar: 1 } }
          );

          if (user) {
            hasAuthorizedCalendar = user.hasAuthorizedCalendar || false;
          }
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
      session.googleScope = token.googleScope || null; // Pasamos el scope a la sesión

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // pages: {
  //   signIn: "/dashboard",
  // },
};
