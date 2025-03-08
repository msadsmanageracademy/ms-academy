"use client";

import EventsForm from "../../components/EventsForm/EventsForm";
import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import { useRouter } from "next/navigation";

const AdminPage = () => {
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
    <>
      <EventsForm />
    </>
  );
};

export default AdminPage;
