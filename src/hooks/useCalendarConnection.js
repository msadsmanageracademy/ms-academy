"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiRequest } from "@/utils/api";
import { confirmReauth, toastError, toastSuccess } from "@/utils/alerts";

/**
 * Google Calendar connection of the admin:
 * - `hasCalendarAccess` starts from the session flag
 * - handles the redirect back from Google (?calendar_connected / ?error) on `returnPath`
 * - `connect()` starts the OAuth flow; `handleReauth(message)` offers it again
 *   when the API answered `requiresReauth`
 */
export function useCalendarConnection(returnPath) {
  const { data: session, update: updateSession } = useSession();
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);

  useEffect(() => {
    if (session) setHasCalendarAccess(session.user.hasAuthorizedCalendar || false);
  }, [session]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "true") {
      toastSuccess(3000, "Operación exitosa", "Google Calendar conectado");
      window.history.replaceState({}, "", returnPath);
      setHasCalendarAccess(true);
      // The session caches the Calendar flag: refresh it from the server
      updateSession();
    }
    if (params.get("error")) {
      toastError(
        4000,
        "Error de autorización",
        params.get("error") === "access_denied"
          ? "Permiso denegado. Debes autorizar el acceso a tu calendario."
          : "No se pudo conectar con Google Calendar",
      );
      window.history.replaceState({}, "", returnPath);
    }
    // Runs once per visit: the query params are removed right away
  }, [returnPath, updateSession]);

  const connect = useCallback(async () => {
    try {
      const res = await apiRequest("/api/google-calendar");
      if (!res.ok || !res.data?.authUrl) {
        return toastError(3000, "Ha habido un error", "No se pudo iniciar la autorización");
      }
      window.location.href = res.data.authUrl;
    } catch (error) {
      console.error("Error connecting calendar:", error);
      toastError(3000, "Ha habido un error", "No se pudo conectar con Google Calendar");
    }
  }, []);

  const handleReauth = useCallback(
    async (message) => {
      setHasCalendarAccess(false);
      if ((await confirmReauth(message)).isConfirmed) await connect();
    },
    [connect],
  );

  return { hasCalendarAccess, connect, handleReauth };
}
