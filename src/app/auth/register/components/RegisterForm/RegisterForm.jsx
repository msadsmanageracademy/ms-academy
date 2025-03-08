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
      console.log("Errores de formulario", errors); // Errores en el form

      /* handleSubmit ya valida el form (según schema definido en Zod) por lo que no es necesario utilizar trigger() para validar manualmente */

      /* Si la validación fue exitosa, hago el POST */

      const response = await fetch("/api/auth/register", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          first_name,
          last_name,
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return toastError(3000, "Error en el registro", result.error);
      }

      toastSuccess(
        3000,
        result.message,
        `Bienvenido, ${result.data.first_name}! Ya puedes iniciar sesión`
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
      <button className="button-primary" type="submit">
        Registrarse
      </button>
    </form>
  );
};

export default RegisterForm;
