"use client";

import Credentials from "@/views/sections/pages/login/Credentials";
import Hero from "@/views/sections/pages/login/Hero";
import PageWrapper from "@/views/components/layout/PageWrapper";
import { signIn } from "next-auth/react";
import { toastLoading } from "@/utils/alerts";

const LoginPage = () => {
  const handleGoogleLogin = async () => {
    toastLoading("Procesando tu solicitud", "Iniciando sesión con Google...");
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <PageWrapper>
      <Hero />
      <Credentials handleGoogleLogin={handleGoogleLogin} />
    </PageWrapper>
  );
};

export default LoginPage;
