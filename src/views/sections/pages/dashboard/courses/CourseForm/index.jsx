import FormField from "@/views/components/ui/FormField";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CourseCreateSchema, CourseFormSchema } from "@/utils/validation";
import { toastError, toastSuccess } from "@/utils/alerts";

const CourseForm = ({ courseData, onSuccess, onCancel }) => {
  const isEditMode = !!courseData;

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(isEditMode ? CourseFormSchema : CourseCreateSchema),
    defaultValues: isEditMode
      ? {
          title: courseData.title,
          short_description: courseData.short_description,
          full_description: courseData.full_description,
        }
      : { max_participants: 0, price: 0 },
  });

  const router = useRouter();
  const errorTitle = isEditMode ? "Error al actualizar curso" : "Error al crear curso";

  const onSubmit = async (values) => {
    try {
      const url = isEditMode ? `/api/courses/${courseData._id}` : "/api/courses/";
      const { title, short_description, full_description, max_participants, price } = values;
      const body = isEditMode
        ? { title, short_description, full_description }
        : { title, short_description, full_description, max_participants, price };

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        method: isEditMode ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) return toastError(3000, errorTitle, result.message);

      toastSuccess(3000, "Operación exitosa", result.message);
      if (onSuccess) {
        onSuccess(result.data);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      toastError(3000, errorTitle, err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
      <FormField label="Título" error={errors?.title?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => <input {...register("title")} {...field} className={styles.input} />}
      </FormField>

      <FormField label="Descripción breve" error={errors?.short_description?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <textarea
            {...register("short_description")}
            {...field}
            className={`${styles.input} ${styles.textarea}`}
          />
        )}
      </FormField>

      <FormField label="Descripción extendida" error={errors?.full_description?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <textarea
            {...register("full_description")}
            {...field}
            className={`${styles.input} ${styles.textarea} ${styles.long}`}
          />
        )}
      </FormField>

      {!isEditMode && (
        <>
          <FormField label="Precio de la Edición 1" error={errors?.price?.message} rowClassName={styles.formRow}
            errorClassName={styles.formCustomError}>
            {(field) => (
              <input
                {...register("price", { valueAsNumber: true })}
                {...field}
                className={`${styles.input} ${styles.number}`}
                inputMode="decimal"
              />
            )}
          </FormField>

          <FormField label="Cupo (0 = sin límite)" error={errors?.max_participants?.message} rowClassName={styles.formRow}
            errorClassName={styles.formCustomError}>
            {(field) => (
              <input
                {...register("max_participants", { valueAsNumber: true })}
                {...field}
                className={`${styles.input} ${styles.number}`}
                inputMode="numeric"
              />
            )}
          </FormField>
        </>
      )}

      <div style={{ display: "flex", gap: "1rem" }}>
        <PrimaryLink asButton text={isEditMode ? "Actualizar" : "Crear curso"} type="submit" />
        {onCancel && <PrimaryLink asButton text="Cancelar" type="button" onClick={onCancel} />}
      </div>
    </form>
  );
};

export default CourseForm;
