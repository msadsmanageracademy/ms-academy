import "react-datepicker/dist/react-datepicker.css";
import { ClassFormSchema } from "@/utils/validation";
import DatePicker from "react-datepicker";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toastError, toastSuccess } from "@/utils/alerts";

const ClassForm = ({ classData, onSuccess, onCancel }) => {
  const isEditMode = !!classData;

  const {
    formState: { errors },
    control,
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(ClassFormSchema),
    defaultValues: classData
      ? {
          title: classData.title,
          short_description: classData.short_description,
          start_date: new Date(classData.start_date),
          duration: classData.duration,
          max_participants: classData.max_participants || 0,
          price: classData.price || 0,
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
    start_date,
    duration,
    max_participants,
    price,
  }) => {
    try {
      const url = isEditMode
        ? `/api/classes/${classData._id}`
        : "/api/classes/";
      const method = isEditMode ? "PATCH" : "POST";

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        method,
        body: JSON.stringify({
          title,
          short_description,
          start_date,
          duration,
          max_participants,
          price,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return toastError(
          3000,
          isEditMode ? "Error al actualizar clase" : "Error al crear clase",
          result.message
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
        isEditMode ? "Error al actualizar clase" : "Error al crear clase",
        err.message
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
        <label>Fecha y hora de inicio</label>
        <Controller
          name="start_date"
          control={control}
          render={({ field }) => (
            <DatePicker
              {...field}
              selected={field.value}
              onChange={(date) => field.onChange(date)}
              timeInputLabel="Hora:"
              dateFormat="dd/MM/yyyy hh:mm aa"
              showTimeInput
              className={`${styles.input}`}
            />
          )}
        />
      </div>
      <div className={styles.formCustomError}>
        {errors?.start_date?.message}
      </div>

      <div className={styles.formRow}>
        <label>Duración (en minutos)</label>
        <input
          {...register("duration", { valueAsNumber: true })}
          className={`${styles.input} ${styles.number}`}
        />
      </div>
      <div className={styles.formCustomError}>{errors?.duration?.message}</div>

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

export default ClassForm;
