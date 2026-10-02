"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";
import { useRouter } from "next/navigation";
import { closeLoading, toastLoading } from "@/utils/alerts";
import { useEffect, useState } from "react";

const AUTH_ERROR_MESSAGES = {
  registration_disabled:
    "El registro de nuevas cuentas está deshabilitado por el momento.",
  AccessDenied: "No tenés permiso para ingresar con esa cuenta.",
  OAuthAccountNotLinked:
    "Ese email ya está registrado con otro método de ingreso.",
};

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode) {
      setError(
        AUTH_ERROR_MESSAGES[errorCode] ||
          "No se pudo iniciar sesión. Intentá de nuevo.",
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    toastLoading("Procesando tu solicitud", "Iniciando sesión");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      closeLoading();

      if (res.code === "rate_limited") {
        setError(
          "Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.",
        );
      } else if (res.error) {
        setError("Credenciales incorrectas");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      closeLoading();
      setError("Error en el servidor. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.text}>O ingresá con tu email y contraseña:</div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label className="visually-hidden" htmlFor="login-email">
            Email
          </label>
          <input
            aria-describedby={error ? "login-error" : undefined}
            autoComplete="email"
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
        </div>
        <div className={styles.formRow}>
          <label className="visually-hidden" htmlFor="login-password">
            Contraseña
          </label>
          <input
            aria-describedby={error ? "login-error" : undefined}
            autoComplete="current-password"
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
          />
        </div>
        <PrimaryLink
          asButton
          dark
          disabled={loading}
          text={"ingresar"}
          type="submit"
        />
      </form>
      <p
        id="login-error"
        role="alert"
        style={{ color: "var(--danger)", fontSize: "0.975rem", marginTop: error ? "1rem" : 0 }}
      >
        {error}
      </p>
    </div>
  );
};

export default LoginPage;
