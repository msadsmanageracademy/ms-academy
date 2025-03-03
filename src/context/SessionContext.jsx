"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toastInformation, toastSuccess } from "@/utils/alerts";

const SessionContext = createContext();

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
  const router = useRouter();

  const [userSession, setUserSession] = useState(null);
  const [contextLoader, setContextLoader] = useState(true);
  const [deniedRoute, setDeniedRoute] = useState(null);

  // Utilizo useEffect para intentar obtener datos de sesión desde localStorage

  useEffect(() => {
    const userSession = JSON.parse(localStorage.getItem("userSession"));
    if (userSession?.token) {
      // Si hay un token en localStorage, realizo solicitud al backend para verificar su validez y obtener los datos del usuario

      // fetch("/api/get-user-info", {
      //   method: "GET",
      //   headers: {
      //     Authorization: `Bearer ${token}`,
      //   },
      // })
      //   .then((res) => res.json())
      //   .then((data) => {
      //     if (data.status === "success") {
      //       setUserSession({
      //
      //         first_name: data.data.user.first_name,
      //         last_name: data.data.user.last_name,
      //         token: data.data.token || token,
      //       });
      //       if (data.data.token) {
      //         Cookies.set("token", data.data.token, { path: "/" });
      //       }
      //       setError(null); // Limpio errores en caso de éxito
      //     } else {
      //       handleAuthError(data.message); // Manejo el error
      //     }
      //   })
      //   .catch(() => {
      //     handleAuthError(); // Manejar error genérico
      //   });

      const response = {
        // Consultar a Martín por el formato
        status: "success",
        data: {
          first_name: "admin",
          last_name: "admin",
          token: "token_renovado_desde_el_backend",
        },
        message: "SUCCESSFULL_TOKEN",
      };

      if (response.status === "success") {
        const {
          data: { first_name, last_name, token },
        } = response;
        setUserSession({ first_name, last_name, token });
        localStorage.setItem(
          "userSession",
          JSON.stringify({
            token,
          })
        );
        toastInformation(
          3000,
          "Sesión validada",
          `Bienvenido de nuevo, ${first_name}`
        );
      }
    }
    setContextLoader(false);
  }, []);

  const login = (sessionData) => {
    setUserSession({
      first_name: sessionData.first_name,
      last_name: sessionData.last_name,
      token: sessionData.token,
      // Puede que se guarde más información en el futuro, ej: role
    });
    localStorage.setItem(
      "userSession",
      JSON.stringify({
        token: sessionData.token,
      })
    );
    const targetRoute = deniedRoute || "/"; // Guardo la ruta negada al usuario
    setDeniedRoute(null); // Limpio deniedRoute
    router.replace(targetRoute); // Ejecuto la redirección

    toastSuccess(
      3000,
      "Inicio de sesión exitoso",
      `Bienvenido ${sessionData.first_name}`
    );

    setContextLoader(false);
  };

  const logout = () => {
    localStorage.removeItem("userSession"); // Borro la session de localStorage
    setUserSession(null); // Borro la session en el FE
    router.replace("/login");
    toastInformation(3000, "Ha cerrado la sesión", `¡Vuelva pronto!`);
  };

  return (
    <SessionContext.Provider
      value={{
        contextLoader,
        login,
        logout,
        setDeniedRoute,
        userSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
