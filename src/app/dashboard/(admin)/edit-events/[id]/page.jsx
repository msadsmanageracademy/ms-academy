"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import { toastError, toastSuccess } from "@/utils/alerts";
import { EventFormSchema } from "@/utils/definitions";
import { useRouter, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import "react-datepicker/dist/react-datepicker.css";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import styles from "./styles.module.css";
import Swal from "sweetalert2";
import Link from "next/link";

const EditEventByIdPage = () => {
  const {
    formState: { errors },
    control,
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(EventFormSchema),
  });

  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

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

      /* Si la validación fue exitosa, hago el PATCH */

      const response = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

      if (!response.ok) {
        return toastError(3000, "Error al editar los datos", result.error);
      }

      console.log("Envié datos al BE");

      toastSuccess(
        3000,
        "Información actualizada",
        "Datos actualizados con éxito"
      );
      router.push("/dashboard/edit-events");
    } catch (err) {
      toastError(3000, "Error al editar los datos", err.message);
    }
  };

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) throw new Error("Error al obtener el curso o clase");

        const data = await res.json();
        setEvent(data.data);
      } catch (err) {
        toastError(3000, "Error al cargar el curso o clase", err);
        router.push("/dashboard/edit-events");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchCourse();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <OvalSpinner />
      </div>
    );
  }

  if (!event) return <p>No se encontró el curso o clase</p>;

  console.log(event);

  return (
    <div className={styles.container}>
      <form
        onSubmit={(e) => {
          console.log("Intentando enviar el formulario...");
          handleSubmit(onSubmit)(e);
        }}
        className={styles.form}
      >
        <div className={styles.formRow}>
          <label>ID</label>
          <input
            {...register("id")}
            className={`${styles.input}`}
            defaultValue={id}
            disabled
          />
        </div>
        <div className={styles.formRow}>
          <label>Tipo de evento</label>
          <input
            {...register("type")}
            className={`${styles.input}`}
            defaultValue={event?.type}
            disabled
          />
        </div>
        <div className={styles.formRow}>
          <label>Título</label>
          <input
            {...register("title")}
            className={`${styles.input}`}
            defaultValue={event?.title}
          />
        </div>
        <div className={styles.formCustomError}>{errors?.title?.message}</div>
        <div className={styles.formRow}>
          <label>Resumen</label>
          <textarea
            {...register("short_description")}
            className={`${styles.input} ${styles.textarea}`}
            defaultValue={event?.short_description}
          />
        </div>
        <div className={styles.formCustomError}>
          {errors?.short_description?.message}
        </div>
        {event.type == "course" && (
          <>
            <div className={styles.formRow}>
              <label>Descripción completa</label>
              <textarea
                {...register("full_description")}
                className={`${styles.input} ${styles.textarea} ${styles.long}`}
                defaultValue={event?.full_description}
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
            defaultValue={event?.start_date ? new Date(event.start_date) : null}
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
        {event.type == "course" && (
          <>
            <div className={styles.formRow}>
              <label>Fecha y hora de finalización</label>
              <Controller
                name="end_date"
                control={control}
                defaultValue={event?.end_date ? new Date(event.end_date) : null}
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
                defaultValue={event?.amount_of_classes}
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
            defaultValue={event?.duration}
          />
        </div>
        <div className={styles.formCustomError}>
          {errors?.duration?.message}
        </div>
        <div className={styles.formRow}>
          <label>Máximo de participantes</label>
          <input
            {...register("max_participants", { valueAsNumber: true })}
            className={`${styles.input} ${styles.number}`}
            defaultValue={event?.max_participants}
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
            defaultValue={event?.price}
          />
        </div>
        <div className={styles.formCustomError}>{errors?.price?.message}</div>
        <button
          type="submit"
          className={`button-primary ${styles.submitButton}`}
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
};

export default EditEventByIdPage;
