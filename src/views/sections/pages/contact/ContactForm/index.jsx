"use client";

import { ContactFormSchema } from "@/utils/validation";
import { toastError, toastSuccess } from "@/utils/alerts";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";

const ContactForm = () => {
  const { data: session } = useSession();

  const {
    formState: { errors, isSubmitting, isSubmitSuccessful },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm({
    resolver: zodResolver(ContactFormSchema),
  });

  // Pre-fill name and email for logged-in users
  useEffect(() => {
    if (session?.user) {
      const { first_name, last_name, email } = session.user;
      const fullName = [first_name, last_name].filter(Boolean).join(" ");
      if (fullName) setValue("name", fullName);
      if (email) setValue("email", email);
    }
  }, [session, setValue]);

  const router = useRouter();

  const onSubmit = async (data) => {
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        toastError(
          4000,
          "Error al enviar",
          json.message || "Intentá de nuevo más tarde.",
        );
        return;
      }

      reset();
      toastSuccess(
        5000,
        "¡Mensaje enviado!",
        "Te responderemos a la brevedad.",
      );
      router.push("/");
    } catch {
      toastError(4000, "Error", "No se pudo conectar con el servidor.");
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="contact-name">Nombre</label>
          <input
            id="contact-name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            type="text"
            autoComplete="name"
            className={styles.input}
            placeholder="Tu nombre"
            {...register("name")}
          />
          {errors.name && (
            <span className={styles.error} id="contact-name-error">{errors.name.message}</span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-email">Email</label>
          <input
            id="contact-email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            type="email"
            autoComplete="email"
            className={styles.input}
            placeholder="tu@email.com"
            {...register("email")}
          />
          {errors.email && (
            <span className={styles.error} id="contact-email-error">{errors.email.message}</span>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-subject">Asunto</label>
        <input
          id="contact-subject"
            aria-invalid={errors.subject ? true : undefined}
            aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          type="text"
          className={styles.input}
          placeholder="¿En qué puedo ayudarte?"
          {...register("subject")}
        />
        {errors.subject && (
          <span className={styles.error} id="contact-subject-error">{errors.subject.message}</span>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor="contact-message">Mensaje</label>
        <textarea
          id="contact-message"
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? "contact-message-error" : undefined}
          className={`${styles.input} ${styles.textarea}`}
          placeholder="Contame más sobre lo que necesitás..."
          {...register("message")}
        />
        {errors.message && (
          <span className={styles.error} id="contact-message-error">{errors.message.message}</span>
        )}
      </div>
      <PrimaryLink
        asButton
        dark
        disabled={isSubmitting}
        text={isSubmitting ? "Enviando..." : "Enviar mensaje"}
        type="submit"
      />
    </form>
  );
};

export default ContactForm;
