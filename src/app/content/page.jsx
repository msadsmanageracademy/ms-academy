"use client";

import { Board } from "@/views/sections/pages/content/Board";
import PageLoader from "@/views/components/layout/PageLoader";
import PageWrapper from "@/views/components/layout/PageWrapper";
import { confirmSignUp, toastError, toastSuccess } from "@/utils/alerts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ContentPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesRes, coursesRes] = await Promise.all([
          fetch("/api/classes"),
          fetch("/api/courses"),
        ]);

        if (!classesRes.ok || !coursesRes.ok) {
          throw new Error("Error fetching data");
        }

        const classesData = await classesRes.json();
        const coursesData = await coursesRes.json();

        setClasses(classesData.data || []);
        setCourses(coursesData.data || []);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const classSignUp = async (id) => {
    try {
      if (!session) {
        return toastError(3000, "Acción no permitida", "Debe iniciar sesión");
      }

      if (session.user.role === "admin") {
        return toastError(
          3000,
          "Acción no permitida",
          "Admins no pueden inscribirse a clases"
        );
      }

      const result = await confirmSignUp(
        "¿Inscribirse a esta clase?",
        "Confirma que deseas inscribirte a esta clase gratuita"
      );

      if (!result.isConfirmed) return;

      const response = await fetch(`/api/classes/sign-up/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const responseData = await response.json();

      if (!response.ok)
        return toastError(3000, "Ha habido un error", responseData.message);

      toastSuccess(3000, "Inscripción exitosa", responseData.message);
      router.push("dashboard/classes");
    } catch (error) {
      return toastError(
        3000,
        "Ha habido un error",
        "Problema inesperado al procesar tu inscripción"
      );
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <PageWrapper>
      <Board
        items={classes}
        title="Clases gratuitas"
        type="class"
        onSignUp={classSignUp}
      />
      <Board items={courses} title="Cursos" type="course" />
    </PageWrapper>
  );
};

export default ContentPage;
