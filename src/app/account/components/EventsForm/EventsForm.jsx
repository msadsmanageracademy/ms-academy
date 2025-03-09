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
    handleSubmit,
    register,
    watch,
  } = useForm({
    resolver: zodResolver(eventMongoSchema),
    defaultValues: {
      max_participants: 0, // Valor por defecto
      amount_of_classes: 2,
      price: 0,
    },
  });

  const router = useRouter();

  const eventType = watch("type");

  const onSubmit = async ({
    type,
    title,
    short_description,
    full_description,
    start_date,
    end_date,
    amount_of_classes,
    duration,
    max_participants,
    price,
  }) => {
    try {
      console.log("Errores de formulario", errors); // Errores en el form

      /* handleSubmit ya valida el form (según schema definido en Zod) por lo que no es necesario utilizar trigger() para validar manualmente */

      /* Si la validación fue exitosa, hago el POST */

      const response = await fetch("/api/events/", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          type,
          title,
          short_description,
          full_description,
          start_date,
          end_date,
          amount_of_classes,
          duration,
          max_participants,
          price,
        }),
      });

      const result = await response.json();

      console.log(response);
      console.log(result);

      if (!response.ok) {
        return toastError(3000, "Error al generar evento", result.message);
      }

      toastSuccess(3000, "Operación exitosa", result.message);

      router.push("/account");
    } catch (err) {
      toastError(3000, "Error al crear evento", err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formRow}>
        <label>Tipo de evento</label>
        <select
          {...register("type")}
          className={`${styles.input} ${styles.select}`}
        >
          <option value="class">Clase</option>
          <option value="course">Curso</option>
        </select>
      </div>
      <div className={styles.formCustomError}>
        {errors?.first_name?.message}
      </div>
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
      {eventType === "course" && (
        <>
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
        </>
      )}
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
      {eventType === "course" && (
        <>
          <div className={styles.formRow}>
            <label>Fecha y hora de finalización</label>
            <Controller
              name="end_date"
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
            {errors?.end_date?.message}
          </div>
          <div className={styles.formRow}>
            <label>Cantidad de clases (mínimo: 2)</label>
            <input
              {...register("amount_of_classes", { valueAsNumber: true })}
              className={`${styles.input} ${styles.number}`}
            />
          </div>
          <div className={styles.formCustomError}>
            {errors?.amount_of_classes?.message}
          </div>
        </>
      )}
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
      <button className="button-primary" type="submit">
        Crear evento
      </button>
    </form>
  );
};

export default EventsForm;
