"use client";

import AccountForm from "@/views/sections/pages/dashboard/account/AccountForm";
import PageLoader from "@/views/components/layout/PageLoader";
import styles from "./styles.module.css";
import { toastError } from "@/utils/alerts";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const AccountPage = () => {
  const { data: session, update } = useSession();
  const userId = session?.user?.id;
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const retrieveUserData = async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        const result = await response.json();

        if (!response.ok)
          return toastError(
            3000,
            "Error al recuperar el usuario",
            result.message
          );

        setUserData(result.data);
      } catch (err) {
        toastError(3000, "Error al cargar la data del usuario", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) retrieveUserData();
  }, [userId]);

  if (loading) {
    return <PageLoader />;
  }

  if (!userData) {
    return (
      <div className={styles.container}>
        <div>No se pudo obtener la data del usuario</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Mi Cuenta</h1>
      <AccountForm userData={userData} userId={userId} onUpdate={update} />
    </div>
  );
};

export default AccountPage;
