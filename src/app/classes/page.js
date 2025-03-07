"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import { useEffect, useMemo, useState } from "react";
import { toastError } from "@/utils/alerts";
import styles from "./styles.module.css";

const ClassesPage = () => {
  const [events, setEvents] = useState([]); // Estado para guardar los eventos
  const [loading, setLoading] = useState(true);

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

  console.log(events);

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
      <div className={styles.courses}>
        <div className={styles.title}>Cursos</div>
        {courses.map(({ _id, title, description, date, amount_of_classes }) => (
          <div key={_id} className={styles.text}>
            <div>Título: {title} </div>
            <div>Descripción: {description} </div>
            <div>
              Fecha y hora:{" "}
              {date
                ? new Date(date).toLocaleString("es-AR")
                : "No se puede mostrar la fecha"}
            </div>
            <div>Cantidad de clases: {amount_of_classes} </div>
          </div>
        ))}
      </div>
      <div className={styles.classes}>
        <div className={styles.title}>Clases gratuitas</div>

        {classes.map(({ _id, title, description, date, duration }) => (
          <div key={_id} className={styles.text}>
            <div>Título: {title} </div>
            <div>Descripción: {description} </div>
            <div>
              Fecha y hora:{" "}
              {date
                ? new Date(date).toLocaleString("es-AR")
                : "No se puede mostrar la fecha"}
            </div>
            <div>Duración: {duration} minutos </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClassesPage;
