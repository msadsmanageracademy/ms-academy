import FormField from "@/views/components/ui/FormField";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CourseFormSchema,
  PublishedCourseEditSchema,
} from "@/utils/validation";
import { toastError, toastSuccess } from "@/utils/alerts";

const CourseForm = ({ courseData, onSuccess, onCancel }) => {
  const isEditMode = !!courseData;
  const isPublished = courseData?.status === "published";

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(
      isPublished ? PublishedCourseEditSchema : CourseFormSchema,
    ),
    defaultValues: courseData
      ? {
          title: courseData.title,
          short_description: courseData.short_description,
          full_description: courseData.full_description,
          max_participants: courseData.max_participants || 0,
          price: courseData.price || 0,
        }
      : {
          max_participants: 0,
          price: 0,
        },
  });

  const router = useRouter();

  const onSubmit = async ({
    title,
    short_description,
    full_description,
    max_participants,
    price,
  }) => {
    try {
      const url = isEditMode
        ? `/api/courses/${courseData._id}`
        : "/api/courses/";
      const method = isEditMode ? "PATCH" : "POST";

      const body = isPublished
        ? { title, short_description, full_description }
        : {
            title,
            short_description,
            full_description,
            max_participants,
            price,
          };

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        method,
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        return toastError(
          3000,
          isEditMode ? "Error al actualizar curso" : "Error al crear curso",
          result.message,
        );
      }

      toastSuccess(3000, "Operación exitosa", result.message);

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      toastError(
        3000,
        isEditMode ? "Error al actualizar curso" : "Error al crear curso",
        err.message,
      );
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

      <FormField label="Máximo de participantes" error={errors?.max_participants?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...register("max_participants", { valueAsNumber: true })}
            {...field}
            className={`${styles.input} ${styles.number} ${isPublished ? styles.inputDisabled : ""}`}
            disabled={isPublished}
            inputMode="numeric"
          />
        )}
      </FormField>

      <FormField label="Precio" error={errors?.price?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...register("price", { valueAsNumber: true })}
            {...field}
            className={`${styles.input} ${styles.number} ${isPublished ? styles.inputDisabled : ""}`}
            disabled={isPublished}
            inputMode="decimal"
          />
        )}
      </FormField>

      <div style={{ display: "flex", gap: "1rem" }}>
        <PrimaryLink asButton text={isEditMode ? "Actualizar" : "Crear"} type="submit" />
        {isEditMode && onCancel && (
          <PrimaryLink asButton text="Cancelar" type="button" onClick={onCancel} />
        )}
      </div>
    </form>
  );
};

export default CourseForm;
