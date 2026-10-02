"use client";

import { EditAccountFormSchema } from "@/utils/validation";
import FormField from "@/views/components/ui/FormField";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastError, toastSuccess } from "@/utils/alerts";

const AccountForm = ({ userData, userId }) => {
  // Refreshes the name shown in the session after saving
  const { update: onUpdate } = useSession();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(EditAccountFormSchema),
    defaultValues: {
      first_name: userData?.first_name || "",
      last_name: userData?.last_name || "",
      age: userData?.age || null,
    },
  });

  const router = useRouter();

  const onSubmit = async (data) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

      if (result.data?.first_name && onUpdate) {
        await onUpdate({ name: result.data.first_name });
      }

      toastSuccess(3000, "Operación exitosa", result.message);
      router.push("/dashboard");
    } catch (err) {
      toastError(3000, "Ha habido un error", "Ha sucedido un error inesperado");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
      <FormField label="Nombre" error={errors?.first_name?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...register("first_name")}
            {...field}
            autoComplete="given-name"
            className={styles.input}
            placeholder="Ingrese su nombre"
          />
        )}
      </FormField>

      <FormField label="Apellido" error={errors?.last_name?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...register("last_name")}
            {...field}
            autoComplete="family-name"
            className={styles.input}
            placeholder="Ingrese su apellido"
          />
        )}
      </FormField>

      <FormField label="Email" rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...field}
            className={`${styles.input} ${styles.readOnly}`}
            readOnly
            type="email"
            value={userData?.email || ""}
          />
        )}
      </FormField>

      <FormField label="Edad" error={errors?.age?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...register("age", { valueAsNumber: true })}
            {...field}
            className={`${styles.input} ${styles.number}`}
            placeholder="Ingrese su edad"
            type="number"
          />
        )}
      </FormField>

      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
        <PrimaryLink asButton dark text="Guardar" type="submit" />
      </div>
    </form>
  );
};

export default AccountForm;
