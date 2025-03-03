"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import RegisterForm from "@/components/RegisterForm/page";
// import { useSession } from "@/context/SessionContext";
import styles from "./styles.module.css";

const RegisterPage = () => {
  // const { contextLoader, logout, userSession } = useSession();

  const userSession = false; // TEMPORAL
  const contextLoader = false; // TEMPORAL

  if (contextLoader) return <OvalSpinner />;

  return userSession ? (
    <div className={styles.container}>
      <div>
        Para registrar un nuevo usuario, primero debe cerrar la sesión actual
      </div>
      <div>Usuario: {userSession.first_name}</div>
      <button className="button-primary" onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  ) : (
    <div className={styles.container}>
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;
