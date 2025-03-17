"use client";

import RegisterForm from "./components/RegisterForm/RegisterForm";
import { Google } from "@/components/icons/Google";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";

const RegisterPage = () => {
  const handleGoogleLogin = async () => {
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className={styles.container}>
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
    </div>
  );
};

export default RegisterPage;
