"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import { toastError, toastSuccess } from "@/utils/alerts";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./styles.module.css";
import Link from "next/link";

const ClassesPage = () => {
  const { data: session, status } = useSession();

  const router = useRouter();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const signUpForTheEvent = async (id) => {
    try {
      console.log("Me ejecuté");
      console.log(id);
      if (!session) {
        return toastError(
          3000,
          "Error al inscribirse",
          "Para inscribirse, primero debe iniciar sesión"
        );
      }

      const response = await fetch(`/api/events/sign-up/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const result = await response.json();

      console.log(response);
      console.log(result);

      if (!response.ok)
        return toastError(3000, "Error al inscribirse", result.message);

      toastSuccess(3000, "Inscripción exitosa", result.message);
      router.push("account/my-classes");
    } catch (error) {
      return toastError(
        3000,
        "Error al inscribirse",
        "Hubo un problema inesperado al procesar tu inscripción"
      );
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) throw new Error("Error al obtener los eventos");

        const data = await res.json();
        setEvents(data.data);
      } catch (err) {
        toastError(3000, "Error en el registro", err);
      } finally {
        setLoading(false); // Al hacerlo en finally, me aseguro que se ejecute independientemente del resultado de try o catch
      }
    };

    fetchEvents();
  }, []);

  /* Utilizo useMemo() para filtrar y guardar en la memoria, solo se repetirán si events cambia */

  const courses = useMemo(
    () => events.filter(({ type }) => type === "course"),
    [events]
  );
  const classes = useMemo(
    () => events.filter(({ type }) => type === "class"),
    [events]
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <OvalSpinner />
      </div>
    );
  }
  return (
    <div className={styles.container}>
      <div className={styles.classes}>
        <div className={styles.title}>Cursos</div>
        {!courses.length && <div>Aún no hay cursos para mostrar</div>}
        {courses.map(
          ({
            _id,
            title,
            short_description,
            full_description,
            start_date,
            end_date,
            amount_of_classes,
            duration,
            max_participants,
          }) => (
            <div key={_id} className={styles.text}>
              <div>Título: {title} </div>
              <div>Resumen: {short_description} </div>
              <div>Descripción completa: {full_description} </div>
              <div>
                Inicia:{" "}
                {start_date
                  ? new Date(start_date).toLocaleString("es-AR", {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "No se puede mostrar la fecha"}
              </div>
              <div>
                Finaliza:{" "}
                {end_date
                  ? new Date(end_date).toLocaleString("es-AR", {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "No se puede mostrar la fecha"}
              </div>
              <div>Cantidad de clases: {amount_of_classes} </div>
              <div>Duración total: {duration / 60} horas</div>
              <div>Cupo: {max_participants} personas</div>
              <Link
                href={`/classes/${_id}`}
                className={`button-primary ${styles.button}`}
              >
                Ver más
              </Link>
            </div>
          )
        )}
      </div>
      <div className={styles.classes}>
        <div className={styles.title}>Clases gratuitas</div>
        {!classes.length && <div>Aún no hay clases para mostrar</div>}
        {classes.map(
          ({ _id, title, short_description, start_date, duration }) => (
            <div key={_id} className={styles.text}>
              <div>Título: {title} </div>
              <div>Descripción: {short_description} </div>
              <div>
                Inicia:{" "}
                {start_date
                  ? new Date(start_date).toLocaleString("es-AR", {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "No se puede mostrar la fecha"}
              </div>
              <div>Duración: {duration} minutos </div>
              <button
                className={`button-primary ${styles.button}`}
                onClick={() => signUpForTheEvent(_id)}
              >
                Inscribirse
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ClassesPage;
