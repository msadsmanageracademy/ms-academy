"use client";

import { RegisterFormSchema } from "@/utils/definitions";
import { usePathname, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserProfile } from "../icons/UserProfile";
import { toastFormError } from "@/utils/alerts";
import { toastSuccess } from "@/utils/alerts";
import { useForm } from "react-hook-form";
import styles from "./styles.module.css";
import { motion } from "framer-motion";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const RegisterForm = () => {
  const router = useRouter();

  const [preview, setPreview] = useState();
  const [avatar, setAvatar] = useState(null); // Solo utilizo setAvatar, útil para validar por zod

  const uploadButtonLabel = preview ? "Modificar imagen" : "Subir imagen";

  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm({
    resolver: zodResolver(RegisterFormSchema),
  });

  const onSubmit = async ({
    first_name,
    last_name,
    email,
    password,
    avatar,
  }) => {
    try {
      const formData = new FormData();
      formData.append("first_name", first_name);
      formData.append("last_name", last_name);
      formData.append("email", email);
      formData.append("password", password);
      if (avatar) formData.append("avatar", avatar);

      // const apiURL = process.env.NEXT_PUBLIC_API_URL;

      // const response = await axios.post(`${apiURL}/api/user/register`, {
      //   username,
      //   password,
      // });

      // Como uso axios, entiendo que si hubo error (HTTP fuera del rango 200 - 299) va a entrar automáticamente al catch.
      // Teniendo esto en cuenta, no sería necesario analizar el status de response.

      const response = {
        status: "success",
        data: {
          first_name: "prueba",
          last_name: "prueba",
          email: "prueba@prueba.com",
          avatar: null,
          avatar_thumbnail: null,
        },
        message: "USER_REGISTER_COMPLETED",
      };

      if (response.status === "success") {
        // Puede que elimine el if por lo explicado más arriba
        const {
          data: { first_name },
        } = response;

        toastSuccess(
          3000,
          "Usuario creado con éxito",
          `Hola ${first_name}, ya puede iniciar sesión`
        );

        router.push("/login");
      }
    } catch (err) {
      const response = {
        status: "error",
        errors: {
          first_name: ["The first name field is required."],
          last_name: ["The last name field is required."],
          email: ["The email has already been taken."],
          password: [
            "The password field must be at least 8 characters.",
            "The password field format is invalid.",
          ],
        },
      };

      const {
        errors: { email },
      } = response;

      if (email)
        return toastError(
          3000,
          "Error al crear usuario",
          "El apellido es requerido"
        );
      else
        return toastError(
          3000,
          "Error inesperado",
          "Por favor, intente nuevamente"
        );
    }
  };

  const handleAvatarChange = (event) => {
    console.log("Actualizo imagen");
    const image = event.target.files[0];

    if (image) {
      const urlImage = URL.createObjectURL(image); // Genero la URL de la imagen, necesaria para mostrar el preview
      setPreview(urlImage); // Guardo la URL en preview
      setAvatar(image);
      setValue("avatar", image); // Actualiza el valor del campo en React Hook Form
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <div className={styles.formRow}>
        <input {...register("first_name")} placeholder="Nombre" />
      </div>
      <div className={styles.formCustomError}>
        {errors?.first_name?.message}
      </div>
      <div className={styles.formRow}>
        <input {...register("last_name")} placeholder="Apellido" />
      </div>
      <div className={styles.formCustomError}>{errors?.last_name?.message}</div>
      <div className={styles.formRow}>
        <input {...register("email")} placeholder="Email" />
      </div>
      <div className={styles.formCustomError}>{errors?.email?.message}</div>
      <div className={styles.formRow}>
        <input
          {...register("password")}
          type="password"
          placeholder="Contraseña"
        />
      </div>
      <div className={styles.formCustomError}>{errors?.password?.message}</div>
      <div className={styles.imageContainer}>
        <input
          id="avatar"
          type="file"
          accept="image/*"
          className={styles.hidden}
          {...register("avatar", {
            onChange: handleAvatarChange, // Necesario por cómo react hook form maneja el cambio de estado en <input type="file" />
          })}
        />
        <label htmlFor="avatar" className={styles.imageInput}>
          {uploadButtonLabel}
        </label>
        {preview ? (
          <Image alt="User avatar" src={preview} width={64} height={64} />
        ) : (
          <UserProfile size={64} />
        )}
      </div>
      <div className={styles.formCustomError}>{errors?.avatar?.message}</div>

      <button type="submit" className="button-primary">
        Registrarse
      </button>
    </form>
  );
};

export default RegisterForm;
