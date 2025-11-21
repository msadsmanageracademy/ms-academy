"use client";

import PageWrapper from "@/views/components/layout/PageWrapper";
import RegisterForm from "./components/RegisterForm/RegisterForm";
import { Google } from "@/views/components/icons/Google";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";

const RegisterPage = () => {
  const handleGoogleLogin = async () => {
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <PageWrapper>
      <div className={styles.title}>Creá tu cuenta</div>
      <button
        className={`button-primary ${styles.googleLogin}`}
        onClick={handleGoogleLogin}
      >
        <Google size={24} />
        Registrate con Google
      </button>
      <div className={styles.text}>O registrate con tu email y contraseña:</div>
      <RegisterForm />
    </PageWrapper>
  );
};

export default RegisterPage;
