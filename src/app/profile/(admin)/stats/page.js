"use client";

import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import { useRouter } from "next/navigation";

const StatsAdminPage = () => {
  const { data: session } = useSession(); // Obtiene el estado de la sesión
  const router = useRouter();

  if (session.user.role !== "admin") {
    toastError(
      3000,
      `Credenciales inválidas`,
      `Acceso denegado (rol: ${session.user.role})`
    );
    router.push("/profile");
    return null; // Evito que se renderice el contenido hasta que se redirija
  }

  return (
    <div>
      <div>Esta será la página de estadísticas generales</div>
    </div>
  );
};

export default StatsAdminPage;
