"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import Sidebar from "./components/Sidebar/Sidebar";
import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import { useRouter } from "next/navigation";
import styles from "./layout.module.css";

export default function ProfileLayout({ children }) {
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
      <div className={styles.dashboard}>{children}</div>
    </div>
  );
}
