"use client";

import { toastError, toastSuccess } from "@/utils/alerts";
import { RegisterFormSchema } from "@/utils/definitions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import styles from "./styles.module.css";

const RegisterForm = () => {
  const router = useRouter();

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(RegisterFormSchema),
  });

  const onSubmit = async ({ first_name, last_name, email, password }) => {
    try {
      const formData = new FormData();
      formData.append("first_name", first_name);
      formData.append("last_name", last_name);
      formData.append("email", email);
      formData.append("password", password);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      }); // No es necesario establecer el Content-Type manualmente, porque FormData lo maneja automáticamente.

      const result = await response.json();

      if (!response.ok) {
        return toastError(3000, "Error en el registro", result.error);
      }

      toastSuccess(
        3000,
        "Usuario creado con éxito",
        `Bienvenido, ${result.data.first_name}!`
      );

      router.push("/auth/login");
    } catch (err) {
      toastError(3000, "Error al registrarse", err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formRow}>
        <input {...register("first_name")} placeholder="Nombre" />
      </div>
      <div className={styles.formCustomError}>
        {errors?.first_name?.message}
      </div>
      <div className={styles.formRow}>
        <input {...register("last_name")} placeholder="Apellido" />
      </div>
      <div className={styles.formCustomError}>{errors?.last_name?.message}</div>
      <div className={styles.formRow}>
        <input {...register("email")} placeholder="Email" />
      </div>
      <div className={styles.formCustomError}>{errors?.email?.message}</div>
      <div className={styles.formRow}>
        <input
          {...register("password")}
          type="password"
          placeholder="Contraseña"
        />
      </div>
      <div className={styles.formCustomError}>{errors?.password?.message}</div>
      <button type="submit" className="button-primary">
        Registrarse
      </button>
    </form>
  );
};

export default RegisterForm;
