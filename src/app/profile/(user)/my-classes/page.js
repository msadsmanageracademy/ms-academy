"use client";

import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import { useRouter } from "next/navigation";

const MyClassesPage = () => {
  const { data: session } = useSession(); // Obtiene el estado de la sesión
  const router = useRouter();

  if (session.user.role !== "user") {
    router.push("/profile");
    toastError(
      3000,
      `Credenciales inválidas`,
      `Acceso denegado (rol: ${session.user.role})`
    );
    return null; // Evito que se renderice el contenido hasta que se redirija
  }

  return (
    <div>
      <div>Aquí se mostrarán las clases y cursos reservados por el usuario</div>
    </div>
  );
};

export default MyClassesPage;
