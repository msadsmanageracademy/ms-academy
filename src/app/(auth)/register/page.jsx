"use client";

import PageWrapper from "@/views/components/layout/PageWrapper";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import RegisterForm from "@/views/sections/pages/register/RegisterForm";
import { config } from "@/config";
import { currentCallbackUrl } from "@/utils/redirects";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";

const RegisterPage = () => {
  const handleGoogleLogin = async () => {
    await signIn("google", { callbackUrl: currentCallbackUrl() });
  };

  if (!config.allowRegistration) {
    return (
      <PageWrapper>
        <div className={styles.container}>
          <h1 className={styles.title}>Registro cerrado</h1>
          <p className={styles.text}>
            Por el momento no se pueden crear cuentas nuevas. Si querés participar de
            una clase o curso, escribime y te ayudo.
          </p>
          <PrimaryLink dark href="/contact" text="Contactar" />
          <PrimaryLink href="/login" text="Ya tengo cuenta" />
        </div>
      </PageWrapper>
    );
  }

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
