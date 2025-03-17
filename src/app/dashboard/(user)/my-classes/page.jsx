"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

const MyClassesPage = () => {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [googleCalendarAuthorized, setGoogleCalendarAuthorized] =
    useState(false);

  useEffect(() => {
    if (session?.googleAccessToken && session?.user?.hasAuthorizedCalendar) {
      session?.googleScope?.includes(
        "https://www.googleapis.com/auth/calendar.events"
      )
        ? fetchCalendarEvents()
        : requestCalendarAccess();
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

  const fetchCalendarEvents = async () => {
    if (!session?.googleAccessToken) return;

    setLoading(true);
    setGoogleCalendarAuthorized(true);

    try {
      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          headers: {
            Authorization: `Bearer ${session.googleAccessToken}`,
          },
        }
      );

      if (!res.ok) {
        console.error("Error fetching events:", res.status);
        return;
      }

      const data = await res.json();
      setEvents(data.items || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const requestCalendarAccess = async () => {
    // Debo ejecutar updateCalendarAccess() antes de signIn porque sino no se ejecuta (por el redirect).
    // TODO: Investigar si puedo encadenar el método signIn de next-auth con otra función

    setLoading(true); // Estado de carga

    await updateCalendarAccess();

    await signIn(
      "google",
      { callbackUrl: "/dashboard/my-classes" },
      {
        scope:
          "openid email profile https://www.googleapis.com/auth/calendar.events",
      }
    );
  };

  console.log(googleCalendarAuthorized);

  console.log(events.length);

  if (loading || status === "loading") {
    return <OvalSpinner />;
  }

  if (!googleCalendarAuthorized) {
    return (
      <div>
        <p>Para ver tus eventos, conecta tu cuenta de Google Calendar.</p>
        <button onClick={requestCalendarAccess}>
          Solicitar acceso a Calendar
        </button>
      </div>
    );
  }

  if (googleCalendarAuthorized && events.length === 0) {
    return <p>No hay eventos en tu Google Calendar.</p>;
  }

  // Si hay eventos, los mostramos
  return (
    <div>
      <h3>Eventos en tu Google Calendar:</h3>
      <ul>
        {events.map((event) => (
          <li key={event.id}>{event.summary}</li>
        ))}
      </ul>
    </div>
  );
};

export default MyClassesPage;
