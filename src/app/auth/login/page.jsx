"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import LoginForm from "./components/LoginForm/LoginForm";
import { Google } from "@/components/icons/Google";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";

const LoginPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  // Para casos en los que el usuario ya haya iniciado sesión pero acceda a /login

  if (!session && status === "loading")
    return (
      <div className={styles.container}>
        <OvalSpinner />
      </div>
    );

  console.log(status);

  if (session) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>Ingresá a tu cuenta</div>
      <button
        className={`button-primary ${styles.googleLogin}`}
        onClick={handleGoogleLogin}
      >
        <Google size={24} />
        Iniciar sesión con Google
      </button>
      <div className={styles.text}>O ingresá con tu email y contraseña:</div>
      <LoginForm />
    </div>
  );
};

export default LoginPage;
