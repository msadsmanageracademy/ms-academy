import { EditionFormSchema } from "@/utils/validation";
import FormField from "@/views/components/ui/FormField";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "@/views/sections/pages/dashboard/courses/CourseForm/styles.module.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastError, toastSuccess } from "@/utils/alerts";

const ERROR_TITLE = "Error al actualizar la edición";

/** Price and capacity (0 = no limit) of a draft edition: PATCH /api/editions/[id]. */
const EditionForm = ({ edition, onSuccess, onCancel }) => {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(EditionFormSchema),
    defaultValues: { price: edition.price ?? 0, max_participants: edition.max_participants ?? 0 },
  });

  const onSubmit = async ({ price, max_participants }) => {
    try {
      const response = await fetch(`/api/editions/${edition._id}`, {
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
        body: JSON.stringify({ price, max_participants }),
      });
      const result = await response.json();
      if (!response.ok) return toastError(3000, ERROR_TITLE, result.message);
      toastSuccess(3000, "Operación exitosa", result.message);
      onSuccess?.(result.data);
    } catch (err) {
      toastError(3000, ERROR_TITLE, err.message);
    }
  };

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit(onSubmit)}>
      <FormField
        error={errors?.price?.message}
        errorClassName={styles.formCustomError}
        label="Precio"
        rowClassName={styles.formRow}
      >
        {(field) => (
          <input
            {...register("price", { valueAsNumber: true })}
            {...field}
            className={`${styles.input} ${styles.number}`}
            inputMode="decimal"
          />
        )}
      </FormField>

      <FormField
        error={errors?.max_participants?.message}
        errorClassName={styles.formCustomError}
        label="Cupo (0 = sin límite)"
        rowClassName={styles.formRow}
      >
        {(field) => (
          <input
            {...register("max_participants", { valueAsNumber: true })}
            {...field}
            className={`${styles.input} ${styles.number}`}
            inputMode="numeric"
          />
        )}
      </FormField>

      <div style={{ display: "flex", gap: "1rem" }}>
        <PrimaryLink asButton disabled={isSubmitting} text="Guardar" type="submit" />
        <PrimaryLink asButton text="Cancelar" type="button" onClick={onCancel} />
      </div>
    </form>
  );
};

export default EditionForm;
