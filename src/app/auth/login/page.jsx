"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import LoginForm from "./components/LoginForm/LoginForm";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./styles.module.css";

const LoginPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

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
      <LoginForm />
    </div>
  );
};

export default LoginPage;
