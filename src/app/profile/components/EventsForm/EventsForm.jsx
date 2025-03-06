import { toastError, toastSuccess } from "@/utils/alerts";
import { eventMongoSchema } from "@/utils/definitions";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import "react-datepicker/dist/react-datepicker.css";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import styles from "./styles.module.css";

const EventsForm = () => {
  const {
    formState: { errors },
    control,
    trigger,
    handleSubmit,
    register,
    watch,
  } = useForm({
    resolver: zodResolver(eventMongoSchema),
  });

  const router = useRouter();

  const eventType = watch("type");

  const onSubmit = async ({
    type,
    title,
    description,
    duration,
    max_participants,
    amount_of_classes,
    price,
    date,
  }) => {
    try {
      const isFormValidated = await trigger(); // Valido según schema definido en zod

      console.log(isFormValidated);

      console.log(errors);

      if (!isFormValidated) {
        /* Si falla la validación, return */
        toastError(3000, "Error en el formulario", "Intente nuevamente");
        return;
      }

      const response = await fetch("/api/events/", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          type,
          title,
          description,
          duration,
          max_participants,
          amount_of_classes,
          price,
          date,
        }),
      });

      const result = await response.json();

      console.log(result);

      if (!response.ok) {
        return toastError(3000, "Error al generar evento", result.error);
      }

      toastSuccess(
        3000,
        result.message,
        `Ve los detalles de ${result.data.title} en la sección correspondiente`
      );

      router.push("/profile");
    } catch (err) {
      toastError(3000, "Error al crear evento", err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formRow}>
        <label>Tipo de evento</label>
        <select {...register("type")}>
          <option value="class">Clase</option>
          <option value="course">Curso</option>
        </select>
      </div>
      <div className={styles.formCustomError}>
        {errors?.first_name?.message}
      </div>
      <div className={styles.formRow}>
        <label>Título</label>
        <input {...register("title")} placeholder="Título" />
      </div>
      <div className={styles.formCustomError}>{errors?.title?.message}</div>
      <div className={styles.formRow}>
        <label>Descripción</label>
        <textarea {...register("description")} />
      </div>
      <div className={styles.formCustomError}>
        {errors?.description?.message}
      </div>
      {eventType === "course" && (
        <>
          <div className={styles.formRow}>
            <label>Cantidad de clases</label>
            <input
              {...register("amount_of_classes", { valueAsNumber: true })}
            />
          </div>
          <div className={styles.formCustomError}>
            {errors?.amount_of_classes?.message}
          </div>
        </>
      )}
      <div className={styles.formRow}>
        <label>Fecha y hora de inicio</label>
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <DatePicker
              {...field}
              selected={field.value}
              onChange={(date) => field.onChange(date)}
              timeInputLabel="Hora:"
              dateFormat="dd/MM/yyyy hh:mm aa"
              showTimeInput
            />
          )}
        />
      </div>
      <div className={styles.formCustomError}>{errors?.date?.message}</div>
      <div className={styles.formRow}>
        <label>Duración (en minutos)</label>
        <input {...register("duration", { valueAsNumber: true })} />
      </div>
      <div className={styles.formCustomError}>{errors?.duration?.message}</div>
      <div className={styles.formRow}>
        <label>Máximo de participantes</label>
        <input {...register("max_participants", { valueAsNumber: true })} />
      </div>
      <div className={styles.formCustomError}>
        {errors?.max_participants?.message}
      </div>
      <div className={styles.formRow}>
        <label>Precio</label>
        <input {...register("price", { valueAsNumber: true })} />
      </div>
      <div className={styles.formCustomError}>{errors?.price?.message}</div>
      <button className="button-primary" type="submit">
        Crear evento
      </button>
    </form>
  );
};

export default EventsForm;
