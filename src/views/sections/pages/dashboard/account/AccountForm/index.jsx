import { EditAccountFormSchema } from "@/utils/validation";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastError, toastSuccess } from "@/utils/alerts";

const AccountForm = ({ userData, userId, onUpdate }) => {
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
        return toastError(3000, "Error al editar los datos", result.error);
      }

      if (result.name && onUpdate) {
        await onUpdate({ name: result.name });
      }

      toastSuccess(3000, "Información actualizada", result.message);
      router.push("/dashboard");
    } catch (err) {
      toastError(
        3000,
        "Error al editar los datos",
        "Ha sucedido un error inesperado"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formRow}>
        <label>Nombre</label>
        <input
          {...register("first_name")}
          className={styles.input}
          placeholder="Ingrese su nombre"
        />
      </div>
      <div className={styles.formCustomError}>
        {errors?.first_name?.message}
      </div>

      <div className={styles.formRow}>
        <label>Apellido</label>
        <input
          {...register("last_name")}
          className={styles.input}
          placeholder="Ingrese su apellido"
        />
      </div>
      <div className={styles.formCustomError}>{errors?.last_name?.message}</div>

      <div className={styles.formRow}>
        <label>Email</label>
        <input
          value={userData?.email || ""}
          className={`${styles.input} ${styles.readOnly}`}
          readOnly
        />
      </div>

      <div className={styles.formRow}>
        <label>Edad</label>
        <input
          {...register("age", {
            valueAsNumber: true,
          })}
          type="number"
          className={`${styles.input} ${styles.number}`}
          placeholder="Ingrese su edad"
        />
      </div>
      <div className={styles.formCustomError}>{errors?.age?.message}</div>

      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
        <PrimaryLink asButton text="Guardar" type="submit" />
      </div>
    </form>
  );
};

export default AccountForm;
