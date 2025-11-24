"use client";

import Credentials from "@/views/sections/pages/login/Credentials";
import Hero from "@/views/sections/pages/login/Hero";
import PageLoader from "@/views/components/layout/PageLoader";
import PageWrapper from "@/views/components/layout/PageWrapper";
import { signIn } from "next-auth/react";
import { toastLoading } from "@/utils/alerts";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const LoginPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    toastLoading("Procesando tu solicitud", "Iniciando sesión con Google...");
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  // Para casos en los que el usuario ya haya iniciado sesión pero acceda a /login

  if (!session && status === "loading") return <PageLoader />;

  if (session) {
    router.push("/dashboard");
    return null;
  }

  return (
    <PageWrapper>
      <Hero />
      <Credentials handleGoogleLogin={handleGoogleLogin} />
    </PageWrapper>
  );
};

export default LoginPage;
