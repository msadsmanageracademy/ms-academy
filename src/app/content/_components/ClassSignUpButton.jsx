"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { enrollInClassAction } from "@/server/actions/classes";
import { loginUrl } from "@/utils/redirects";
import { runApiAction } from "@/utils/api";
import { useNotifications } from "@/providers/NotificationProvider";
import { useRouter } from "next/navigation";
import { confirmSignUp } from "@/utils/alerts";

/** Free class sign-up (the only client island of /content); goes through a Server Action. */
const ClassSignUpButton = ({ classId, title, viewerRole }) => {
  const { incrementCount } = useNotifications();
  const router = useRouter();

  const handleClassSignUp = async () => {
    if (!viewerRole) return router.push(loginUrl("/content"));
    const confirmed = await confirmSignUp(
      "¿Querés inscribirte a esta clase?",
      "Confirmá que querés inscribirte a esta clase gratuita",
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
    <PrimaryLink
      aria-label={`Inscribirme a ${title}`}
      asButton
      dark
      onClick={handleClassSignUp}
      text="Inscribirme"
    />
  );
};

export default ClassSignUpButton;
