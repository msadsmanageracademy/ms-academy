"use client";

import OvalSpinner from "@/views/components/ui/OvalSpinner";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Limpiar el error antes de cada intento
    setLoading(true); // Establecer el estado de carga

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res.error) {
        setError("Credenciales incorrectas");
      } else {
        router.push("/dashboard"); // Redirigir después del login exitoso
      }
    } catch (error) {
      setError("Error en el servidor. Inténtalo de nuevo.");
    } finally {
      setLoading(false); // Detener la carga una vez que haya terminado
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
        {loading ? (
          <OvalSpinner />
        ) : (
          <PrimaryLink
            asButton
            disabled={loading}
            text={"ingresar"}
            type="submit"
          />
        )}
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
