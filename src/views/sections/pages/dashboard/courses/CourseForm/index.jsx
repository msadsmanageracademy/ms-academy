import { CourseFormSchema } from "@/utils/validation";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toastError, toastSuccess } from "@/utils/alerts";

const CourseForm = ({ courseData, onSuccess, onCancel }) => {
  const isEditMode = !!courseData;

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(CourseFormSchema),
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

      const body = {
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
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formRow}>
        <label>Título</label>
        <input {...register("title")} className={`${styles.input}`} />
      </div>
      <div className={styles.formCustomError}>{errors?.title?.message}</div>

      <div className={styles.formRow}>
        <label>Descripción breve</label>
        <textarea
          {...register("short_description")}
          className={`${styles.input} ${styles.textarea}`}
        />
      </div>
      <div className={styles.formCustomError}>
        {errors?.short_description?.message}
      </div>

      <div className={styles.formRow}>
        <label>Descripción extendida</label>
        <textarea
          {...register("full_description")}
          className={`${styles.input} ${styles.textarea} ${styles.long}`}
        />
      </div>
      <div className={styles.formCustomError}>
        {errors?.full_description?.message}
      </div>

      <div className={styles.formRow}>
        <label>Máximo de participantes</label>
        <input
          {...register("max_participants", { valueAsNumber: true })}
          className={`${styles.input} ${styles.number}`}
        />
      </div>
      <div className={styles.formCustomError}>
        {errors?.max_participants?.message}
      </div>

      <div className={styles.formRow}>
        <label>Precio</label>
        <input
          {...register("price", { valueAsNumber: true })}
          className={`${styles.input} ${styles.number}`}
        />
      </div>
      <div className={styles.formCustomError}>{errors?.price?.message}</div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <PrimaryLink
          asButton
          text={isEditMode ? "Actualizar" : "Crear"}
          type="submit"
        />
        {isEditMode && onCancel && (
          <PrimaryLink
            asButton
            text={"Cancelar"}
            type="button"
            onClick={onCancel}
          />
        )}
      </div>
    </form>
  );
};

export default CourseForm;
