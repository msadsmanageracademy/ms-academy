"use client";

import FormField from "@/views/components/ui/FormField";
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
      const response = await fetch("/api/auth/register", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return toastError(
          3000,
          "Ha habido un error",
          result.message,
        );
      }

      toastSuccess(3000, "Operación exitosa", "Su cuenta ha sido creada");

      router.push("/login");
    } catch (err) {
      toastError(3000, "Ha habido un error", err.message);
    }
  };

  const hiddenLabel = { hideLabel: true, rowClassName: styles.formRow, errorClassName: styles.formCustomError };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
      <FormField label="Nombre" error={errors?.first_name?.message} {...hiddenLabel}>
        {(field) => (
          <input {...register("first_name")} {...field} autoComplete="given-name" placeholder="Nombre" />
        )}
      </FormField>
      <FormField label="Apellido" error={errors?.last_name?.message} {...hiddenLabel}>
        {(field) => (
          <input {...register("last_name")} {...field} autoComplete="family-name" placeholder="Apellido" />
        )}
      </FormField>
      <FormField label="Email" error={errors?.email?.message} {...hiddenLabel}>
        {(field) => (
          <input {...register("email")} {...field} autoComplete="email" placeholder="Email" type="email" />
        )}
      </FormField>
      <FormField label="Contraseña" error={errors?.password?.message} {...hiddenLabel}>
        {(field) => (
          <input
            {...register("password")}
            {...field}
            autoComplete="new-password"
            placeholder="Contraseña"
            type="password"
          />
        )}
      </FormField>
      <PrimaryLink asButton className={styles.link} text="Registrarse" type="submit" />
    </form>
  );
};

export default RegisterForm;
