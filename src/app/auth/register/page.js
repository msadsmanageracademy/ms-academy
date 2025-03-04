"use client";

import RegisterForm from "@/components/RegisterForm/page";
import styles from "./styles.module.css";

const RegisterPage = () => {
  return (
    <div className={styles.container}>
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;
