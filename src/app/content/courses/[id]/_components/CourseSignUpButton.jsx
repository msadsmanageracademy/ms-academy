"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { enrollInCourseAction } from "@/server/actions/courses";
import { runApiAction } from "@/utils/api";
import { useRouter } from "next/navigation";
import { confirmSignUp, toastError } from "@/utils/alerts";

const CourseSignUpButton = ({ courseId, viewerRole }) => {
  const router = useRouter();

  const handleSignUp = async () => {
    if (!viewerRole) {
      return toastError(3000, "Ha habido un error", "Para inscribirse, primero debe iniciar sesión");
    }
    if (viewerRole === "admin") {
      return toastError(3000, "Acción no permitida", "Admins no pueden inscribirse a cursos");
    }
    const confirmed = await confirmSignUp(
      "¿Inscribirse a este curso?",
      "Confirma que deseas inscribirte a este curso",
    );
    if (!confirmed.isConfirmed) return;

    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Inscribiéndote al curso..."],
      request: () => enrollInCourseAction(courseId),
      success: (r) => ["Inscripción exitosa", r.message],
      failure: "Problema inesperado al procesar tu inscripción",
    });
    if (res) router.push("/dashboard/courses");
  };

  return <PrimaryLink asButton dark text="Inscribirse" onClick={handleSignUp} />;
};

export default CourseSignUpButton;
