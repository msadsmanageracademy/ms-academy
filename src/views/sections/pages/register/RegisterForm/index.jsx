"use client";

import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { RegisterFormSchema } from "@/utils/validation";
import styles from "./styles.module.css";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastError, toastSuccess } from "@/utils/alerts";

const RegisterForm = () => {
  const router = useRouter();

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(RegisterFormSchema),
  });

  const onSubmit = async (data) => {
    try {
      console.log("Errores de formulario", errors); // Errores en el form

      /* handleSubmit ya valida el form (según schema definido en Zod) por lo que no es necesario utilizar trigger() para validar manualmente */

      /* Si la validación fue exitosa, hago el POST */

      const response = await fetch("/api/auth/register", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return toastError(3000, "Ha habido un error", result.error);
      }

      toastSuccess(3000, "Operación exitosa", "Su cuenta ha sido creada");

      router.push("/login");
    } catch (err) {
      toastError(3000, "Ha habido un error", err.message);
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
      <input {...register("role", { value: "user" })} type="hidden" />
      <PrimaryLink
        asButton
        className={styles.link}
        text={"Registrarse"}
        type="submit"
      />
    </form>
  );
};

export default RegisterForm;
