"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import LoginForm from "@/components/loginForm/LoginForm";
// import { useSession } from "@/context/SessionContext";
import styles from "./styles.module.css";

const LoginPage = () => {
  // const { contextLoader, userSession, logout } = useSession();

  const userSession = false; // TEMPORAL
  const contextLoader = false; // TEMPORAL

  if (contextLoader) return <OvalSpinner />;
  return userSession ? (
    <div className={styles.container}>
      <div>Usted ya está logueado!</div>
      <div>Bienvenido, {userSession.first_name}</div>
      <button className="button-primary" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  ) : (
    <div className={styles.container}>
      <LoginForm />
    </div>
  );
};

export default LoginPage;
