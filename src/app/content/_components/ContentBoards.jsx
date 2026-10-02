"use client";

import { Board } from "@/views/sections/pages/content/Board";
import { enrollInClassAction } from "@/server/actions/classes";
import { loginUrl } from "@/utils/redirects";
import { runApiAction } from "@/utils/api";
import { useNotifications } from "@/providers/NotificationProvider";
import { useRouter } from "next/navigation";
import { confirmSignUp, toastError } from "@/utils/alerts";

/** Both boards; enrolling in a free class goes through a Server Action. */
const ContentBoards = ({ classes, courses, viewerRole }) => {
  const { incrementCount } = useNotifications();
  const router = useRouter();

  const handleClassSignUp = async (classId) => {
    if (!viewerRole) return router.push(loginUrl("/content"));
    if (viewerRole === "admin") {
      return toastError(3000, "Acción no permitida", "Admins no pueden inscribirse a clases");
    }
    const confirmed = await confirmSignUp(
      "¿Inscribirse a esta clase?",
      "Confirma que deseas inscribirte a esta clase gratuita",
    );
    if (!confirmed.isConfirmed) return;

    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Inscribiéndote a la clase..."],
      request: () => enrollInClassAction(classId),
      success: (r) => ["Inscripción exitosa", r.message],
      failure: "Problema inesperado al procesar tu inscripción",
    });
    if (res) {
      incrementCount();
      router.push("/dashboard/classes");
    }
  };

  return (
    <>
      <Board items={classes} title="Clases gratuitas" type="class" onSignUp={handleClassSignUp} />
      <Board items={courses} title="Cursos" type="course" />
    </>
  );
};

export default ContentBoards;
