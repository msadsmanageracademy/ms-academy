"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { closeLoading, toastLoading } from "@/utils/alerts";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

      if (res.error) {
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
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
        </div>
        <div className={styles.formRow}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
          />
        </div>
        <PrimaryLink
          asButton
          disabled={loading}
          text={"ingresar"}
          type="submit"
        />
      </form>
      {error && (
        <p style={{ color: "red", fontSize: "0.975rem", marginTop: "1rem" }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default LoginPage;
