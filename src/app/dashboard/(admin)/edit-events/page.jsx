"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import { toastError, toastSuccess } from "@/utils/alerts";
import withReactContent from "sweetalert2-react-content";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";
import Swal from "sweetalert2";
import Link from "next/link";

const EditEventsPage = () => {
  const { data: session } = useSession();
  const MySwal = withReactContent(Swal);

  const [events, setEvents] = useState([]); // Estado para guardar los eventos
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [googleCalendarAuthorized, setGoogleCalendarAuthorized] =
    useState(false);
  const [hasEventBeenAddedToCalendar, setHasEventBeenAddedToCalendar] =
    useState(false);

  useEffect(() => {
    if (
      !session?.googleScope?.includes(
        "https://www.googleapis.com/auth/calendar.events"
      ) &&
      session?.user?.hasAuthorizedCalendar
    ) {
      console.log("No incluye scope + sí ha autorizado previamente");
      requestCalendarAccess({ hasAuthorizedCalendar: true }); // Paso true para informar a la función que ya se ha autorizado a Calendar en el pasado
    }
    if (
      session?.googleScope?.includes(
        "https://www.googleapis.com/auth/calendar.events"
      )
    ) {
      console.log("Incluye scope, estoy autorizado para guardar el evento");
      setGoogleCalendarAuthorized(true);
      setLoadingSession(false);
    }
  }, [session]);

  const updateCalendarAccess = async () => {
    try {
      const response = await fetch(
        `/api/users/${session.user.id}/update-calendar-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hasAuthorizedCalendar: true }),
        }
      );

      const result = await response.json();

      if (!response.ok)
        toastError(3000, "Error al editar los datos", result.error);
    } catch (error) {
      console.error("Error actualizando la base de datos:", error);
    }
  };

  const requestCalendarAccess = async ({ hasAuthorizedCalendar }) => {
    hasAuthorizedCalendar ? setLoadingSession(true) : setLoadingGoogle(true);

    if (!hasAuthorizedCalendar) {
      await updateCalendarAccess();
    }

    await signIn(
      "google",
      { callbackUrl: "/dashboard/edit-events" },
      {
        scope:
          "openid email profile https://www.googleapis.com/auth/calendar.events",
      }
    );
  };

  const addToCalendar = async (event) => {
    if (!session?.googleAccessToken) return;

    setLoadingCalendar(true);

    try {
      const eventDetails = {
        summary: event.title, // Título del evento
        description: event.short_description, // Descripción breve
        start: {
          dateTime: new Date(event.start_date).toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
        },
        end: {
          dateTime: new Date(
            new Date(event.start_date).getTime() + event.duration * 60000
          ).toISOString(),
          timeZone: "America/Argentina/Buenos_Aires",
        },
      };

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.googleAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventDetails),
        }
      );

      if (!response.ok) {
        throw new Error("Error al agregar el evento a Google Calendar");
      }

      const result = await response.json();

      setHasEventBeenAddedToCalendar({
        state: true,
        googleEventUrl: result.htmlLink,
      });

      // PATCH a la API para guardar en la base de datos
      const databaseUpdateResponse = await fetch(`/api/events/${event._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          googleEventId: result.id,
          googleEventUrl: result.htmlLink,
        }),
      });

      if (!databaseUpdateResponse.ok) {
        throw new Error("Error al actualizar el evento en la base de datos");
      }

      toastSuccess(
        3000,
        "Operación exitosa",
        "Evento agregado a Google Calendar con éxito"
      );
    } catch (error) {
      toastError(3000, "Error al agregar el evento", error.message);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const router = useRouter();

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
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

  const handleDeleteEvent = (id) => {
    MySwal.fire({
      title: "Eliminar evento",
      text: "¿Está seguro que desea eliminar el evento?",
      icon: "error",
      showCancelButton: true,
      confirmButtonColor: "#c91111",
      cancelButtonColor: "#292c33",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        deleteEvent(id);
      }
    });
  };

  const deleteEvent = async (id) => {
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        return toastError(3000, "Error al eliminar el evento", result.error);
      }

      toastSuccess(
        3000,
        "Evento eliminado",
        "El evento ha sido eliminado con éxito"
      );

      router.push("/dashboard");
    } catch (err) {
      toastError(3000, "Error al editar los datos", err.message);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <OvalSpinner />
      </div>
    );
  }

  if (loadingGoogle) {
    return (
      <div className={styles.loadingOverlay}>
        <OvalSpinner />
        <p>Aguarde mientras es redirigido a Google...</p>
      </div>
    );
  }

  if (loadingSession) {
    return (
      <div className={styles.loadingOverlay}>
        <OvalSpinner />
        <p>Aguarde mientras se cargan los datos de su sesión...</p>
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
              <div>Título: {title}</div>
              <div>Resumen: {short_description}</div>
              <div>Descripción completa: {full_description}</div>
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
              <div className={styles.buttonsContainer}>
                <Link
                  href={`/dashboard/edit-events/${_id}`}
                  className={`button-primary ${styles.editButton}`}
                >
                  Editar
                </Link>
                <button
                  className={`button-primary ${styles.deleteButton}`}
                  onClick={() => handleDeleteEvent(_id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          )
        )}
      </div>
      <div className={styles.classes}>
        <div className={styles.title}>Clases gratuitas</div>
        {!classes.length && <div>Aún no hay clases para mostrar</div>}
        {classes.map(
          ({
            _id,
            title,
            short_description,
            start_date,
            duration,
            googleEventId,
            googleEventUrl,
          }) => (
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
              {googleEventUrl || hasEventBeenAddedToCalendar?.state ? (
                <Link
                  href={
                    googleEventUrl ||
                    hasEventBeenAddedToCalendar?.googleEventUrl
                  }
                  className={styles.googleCalendarLink}
                  target="_blank"
                >
                  Google Calendar 📅
                </Link>
              ) : null}

              <div className={styles.buttonsContainer}>
                {googleCalendarAuthorized ? (
                  <>
                    <button
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`button-primary ${styles.googleLogin}`}
                      disabled={
                        loadingCalendar ||
                        googleEventId ||
                        hasEventBeenAddedToCalendar
                      }
                      onClick={() =>
                        addToCalendar({
                          _id,
                          title,
                          short_description,
                          start_date,
                          duration,
                        })
                      }
                    >
                      {googleEventId || hasEventBeenAddedToCalendar
                        ? "Agregado a Calendar 📅✅"
                        : "📅 Agregar a Google Calendar"}
                    </button>
                    {loadingCalendar && (
                      <div className={styles.loadingOverlay}>
                        <OvalSpinner />
                        <p>📅 Agregando evento a Google Calendar...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`button-primary ${styles.googleLogin}`}
                    onClick={requestCalendarAccess}
                  >
                    📅 Autorizar Google Calendar
                  </button>
                )}
                <Link
                  href={`/dashboard/edit-events/${_id}`}
                  className={`button-primary ${styles.editButton}`}
                >
                  Editar
                </Link>
                <button
                  className={`button-primary ${styles.deleteButton}`}
                  onClick={() => handleDeleteEvent(_id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default EditEventsPage;
