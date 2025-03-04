"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner"; // Si deseas usar un spinner
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./styles.module.css";
import { useState } from "react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // Nuevo estado para el loading
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
        router.push("/profile"); // Redirigir después del login exitoso
      }
    } catch (error) {
      setError("Error en el servidor. Inténtalo de nuevo.");
    } finally {
      setLoading(false); // Detener la carga una vez que haya terminado
    }
  };

  return (
    <div className={styles.loginPage}>
      <h1>Iniciar Sesión</h1>
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
        <button type="submit" disabled={loading} className="button-primary">
          {loading ? <OvalSpinner /> : "Ingresar"}
        </button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default LoginPage;
