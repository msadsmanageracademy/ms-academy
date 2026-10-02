import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import FormField from "@/views/components/ui/FormField";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useNotifications } from "@/providers/NotificationProvider";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClassFormSchema, PublishedClassEditSchema } from "@/utils/validation";
import { Controller, useForm } from "react-hook-form";
import { GoogleCalendar, GoogleMeet } from "@/views/components/icons";
import {
  closeLoading,
  toastLoading,
  toastError,
  toastSuccess,
} from "@/utils/alerts";
import { useEffect, useState } from "react";

const ClassForm = ({
  classData,
  onSuccess,
  onCancel,
  hasCalendarAccess,
  allowFullEdit = false,
}) => {
  const isEditMode = !!classData;
  const isRestricted =
    classData?.status === "published" ||
    (classData?.status === "enrolled" && !allowFullEdit);
  const { incrementCount } = useNotifications();
  const [addToCalendar, setAddToCalendar] = useState(false);

  const {
    formState: { errors },
    control,
    handleSubmit,
    register,
    reset,
  } = useForm({
    resolver: zodResolver(
      isRestricted ? PublishedClassEditSchema : ClassFormSchema,
    ),
    shouldFocusError: false,
    defaultValues: classData
      ? {
          title: classData.title,
          short_description: classData.short_description,
          start_date: classData.start_date
            ? new Date(classData.start_date)
            : null,
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

  useEffect(() => {
    if (classData) {
      reset({
        title: classData.title,
        short_description: classData.short_description,
        start_date: classData.start_date
          ? new Date(classData.start_date)
          : null,
        duration: classData.duration,
        max_participants: classData.max_participants || 0,
        price: classData.price || 0,
      });
    }
  }, [classData, reset]);

  const onSubmit = async ({
    title,
    short_description,
    start_date,
    duration,
    max_participants,
    price,
  }) => {
    try {
      if (isEditMode) {
        toastLoading("Procesando tu solicitud", "Actualizando clase...");
      } else {
        toastLoading(
          "Procesando tu solicitud",
          addToCalendar
            ? "Creando clase y evento de Google Calendar"
            : "Creando clase",
        );
      }

      const url = isEditMode
        ? `/api/classes/${classData._id}`
        : "/api/classes/";
      const method = isEditMode ? "PATCH" : "POST";

      const payload = isRestricted
        ? { title, short_description }
        : {
            title,
            short_description,
            start_date,
            duration,
            max_participants,
            price,
          };

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        method,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        closeLoading();
        return toastError(
          3000,
          isEditMode
            ? "Ha habido un error al actualizar la clase"
            : "Ha habido un error al crear la clase",
          result.message,
        );
      }

      // If creating a new class and addToCalendar is checked, create calendar event
      if (!isEditMode && addToCalendar && result.data?._id) {
        try {
          const calendarResponse = await fetch(
            `/api/classes/${result.data._id}/calendar-event`,
            {
              method: "POST",
            },
          );

          const calendarData = await calendarResponse.json();

          closeLoading();

          if (!calendarResponse.ok) {
            toastError(
              3000,
              "Clase creada, pero error al agregar a Calendar",
              calendarData.message,
            );
          } else {
            toastSuccess(
              4000,
              "Operación exitosa",
              "Clase creada en Google Calendar",
            );
          }
        } catch (calendarError) {
          console.error("Error adding to calendar:", calendarError);
          closeLoading();
          toastError(
            3000,
            "Clase creada, pero error al agregar a Calendar",
            "La clase se creó correctamente pero no se pudo agregar al calendario",
          );
        }
      } else {
        closeLoading();
        toastSuccess(3000, "Operación exitosa", result.message);
        // Notification created for admin on class create/edit
        if (!isEditMode || classData?.participants?.length > 0) {
          incrementCount();
        }
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      toastError(
        3000,
        isEditMode ? "Error al actualizar clase" : "Error al crear clase",
        err.message,
      );
    }
  };

  const disabledClass = isRestricted ? styles.inputDisabled : "";

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

      <FormField label="Fecha y hora de inicio" error={errors?.start_date?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <Controller
            name="start_date"
            control={control}
            render={({ field: controllerField }) => (
              <DatePicker
                {...controllerField}
                ariaDescribedBy={field["aria-describedby"]}
                ariaInvalid={field["aria-invalid"] ? "true" : undefined}
                className={`${styles.input} ${disabledClass}`}
                dateFormat="dd/MM/yyyy HH:mm"
                disabled={isRestricted}
                id={field.id}
                onChange={(date) => controllerField.onChange(date)}
                selected={controllerField.value}
                showTimeInput
                timeInputLabel="Hora:"
              />
            )}
          />
        )}
      </FormField>

      <FormField label="Duración (en minutos)" error={errors?.duration?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...register("duration", { valueAsNumber: true })}
            {...field}
            className={`${styles.input} ${styles.number} ${disabledClass}`}
            disabled={isRestricted}
            inputMode="numeric"
          />
        )}
      </FormField>

      <FormField label="Máximo de participantes" error={errors?.max_participants?.message} rowClassName={styles.formRow}
        errorClassName={styles.formCustomError}>
        {(field) => (
          <input
            {...register("max_participants", { valueAsNumber: true })}
            {...field}
            className={`${styles.input} ${styles.number} ${disabledClass}`}
            disabled={isRestricted}
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
            className={`${styles.input} ${styles.number} ${disabledClass}`}
            disabled={isRestricted}
            inputMode="decimal"
          />
        )}
      </FormField>

      {!isEditMode && hasCalendarAccess && (
        <div className={styles.checkboxRow}>
          <input
            type="checkbox"
            id="addToCalendar"
            checked={addToCalendar}
            onChange={(e) => setAddToCalendar(e.target.checked)}
            className={styles.checkbox}
          />
          <label htmlFor="addToCalendar" className={styles.checkboxLabel}>
            <GoogleCalendar /> Calendar / <GoogleMeet /> Meet
            <span className="visually-hidden"> (crear el evento al guardar)</span>
          </label>
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem" }}>
        <PrimaryLink asButton text={isEditMode ? "Actualizar" : "Crear"} type="submit" />
        {isEditMode && onCancel && (
          <PrimaryLink asButton text="Cancelar" type="button" onClick={onCancel} />
        )}
      </div>
    </form>
  );
};

export default ClassForm;
