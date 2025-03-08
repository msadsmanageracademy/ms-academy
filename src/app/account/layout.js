"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import Sidebar from "./components/Sidebar/Sidebar";
import { useMediaQuery } from "react-responsive";
import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import { useRouter } from "next/navigation";
import styles from "./layout.module.css";

export default function ProfileLayout({ children }) {
  const isXL = useMediaQuery({ query: "(min-width: 1200px)" });
  const isL = useMediaQuery({ query: "(min-width: 992px)" });
  const isM = useMediaQuery({ query: "(min-width: 768px)" });
  const isSm = useMediaQuery({ query: "(min-width: 576px)" });
  const isXS = useMediaQuery({ query: "(min-width: 400px)" });

  const { data: session, status } = useSession(); // Obtiene el estado de la sesión
  const router = useRouter();

  if (status === "loading")
    return (
      <div className={styles.container}>
        <OvalSpinner />
      </div>
    );

  if (!session) {
    router.push("/auth/login");
    toastError(
      3000,
      `No hay sesión activa`,
      `Acceso denegado: debe iniciar sesión`
    );
    return null; // Evito que se renderice el layout hasta que se redirija
  }

  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={`${styles.dashboard} ${!isSm ? styles.mobile : ""}`}>
        {children}
      </div>
    </div>
  );
}
