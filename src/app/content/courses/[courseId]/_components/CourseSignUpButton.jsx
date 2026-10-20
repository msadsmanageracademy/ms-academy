"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { enrollInEditionAction } from "@/server/actions/courses";
import { loginUrl } from "@/utils/redirects";
import { runApiAction } from "@/utils/api";
import { useRouter } from "next/navigation";
import { confirmSignUp, toastError } from "@/utils/alerts";

/** Enrolls the user in the edition open to enrollment (`editionTitle` = "Curso · Septiembre 2026"). */
const CourseSignUpButton = ({ courseId, editionId, editionTitle, viewerRole }) => {
  const router = useRouter();

  const handleSignUp = async () => {
    if (!viewerRole) return router.push(loginUrl(`/content/courses/${courseId}`));
    if (viewerRole === "admin") {
      return toastError(3000, "Acción no permitida", "Admins no pueden inscribirse a cursos");
    }
    const confirmed = await confirmSignUp(
      "¿Querés inscribirte a este curso?",
      `Confirmá que querés inscribirte a "${editionTitle}"`,
    );
    if (!confirmed.isConfirmed) return;

    const res = await runApiAction({
      loading: ["Procesando tu solicitud", "Inscribiéndote al curso..."],
      request: () => enrollInEditionAction(editionId),
      success: (r) => ["Inscripción exitosa", r.message],
      failure: "Problema inesperado al procesar tu inscripción",
    });
    if (res) router.push("/dashboard/courses");
  };

  return <PrimaryLink asButton dark text="Inscribirse" onClick={handleSignUp} />;
};

export default CourseSignUpButton;
