"use client";

import PageWrapper from "@/views/components/layout/PageWrapper";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import RegisterForm from "@/views/sections/pages/register/RegisterForm";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";

const RegisterPage = () => {
  const handleGoogleLogin = async () => {
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <PageWrapper>
      <div className={styles.container}>
        <h1 className={styles.title}>Creá tu cuenta</h1>
        <PrimaryLink
          asButton
          google
          text={"Registrate con Google"}
          onClick={handleGoogleLogin}
        />
        <div className={styles.text}>
          O registrate con tu email y contraseña:
        </div>
        <RegisterForm />
      </div>
    </PageWrapper>
  );
};

export default RegisterPage;
