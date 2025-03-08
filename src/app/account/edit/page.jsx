"use client";

import { UserProfile } from "@/components/icons/UserProfile";
import OvalSpinner from "@/components/spinners/OvalSpinner";
import { EditAccountFormSchema } from "@/utils/definitions";
import { toastError, toastSuccess } from "@/utils/alerts";
import { zodResolver } from "@hookform/resolvers/zod";
import { CldUploadWidget } from "next-cloudinary";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import styles from "./styles.module.css";
import Image from "next/image";

const EditPage = () => {
  const {
    formState: { errors },
    trigger,
    handleSubmit,
    register,
  } = useForm({
    resolver: zodResolver(EditAccountFormSchema),
    defaultValues: {}, // Aquí puedes cargar los valores por defecto desde la DB
  });

  const { data: session } = useSession(); // Obtiene el estado de la sesión
  const router = useRouter();

  const userId = session?.user?.id;
  const [userData, setUserData] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const retrieveUserData = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (!res.ok) throw new Error("Error al obtener los datos del usuario");

        const data = await res.json();
        setUserData(data.data);
      } catch (err) {
        toastError(3000, "Error al cargar la data del usuario", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) retrieveUserData();
  }, [userId]);

  const onSubmit = async ({ first_name, last_name, age }) => {
    try {
      const isFormValidated = await trigger(); // Validar el formulario

      if (!isFormValidated) {
        toastError(3000, "Error en el formulario", "Intente nuevamente");
        return;
      }

      // Si la validación es exitosa, enviar los datos para actualización
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name, last_name, age, avatarUrl }),
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
      router.push("/account");
    } catch (err) {
      toastError(3000, "Error al editar los datos", err.message);
    }
  };

  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (userData?.avatarUrl) {
      setAvatarUrl(userData.avatarUrl);
    }
  }, [userData]); // Así puedo actualizar la avatarUrl cuando se obtiene userData

  const handleUpload = async (result) => {
    if (result.event === "success") {
      const imageUrl = result.info.secure_url;
      const publicId = result.info.public_id;

      try {
        const updateResponse = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatarUrl: imageUrl,
            avatarPublicId: publicId,
          }),
        });

        await updateResponse.json();
        if (!updateResponse.ok) {
          throw new Error("Error al actualizar el avatar del usuario");
        }

        setAvatarUrl(imageUrl);
        toastSuccess(
          3000,
          "Avatar actualizado",
          "Avatar actualizado con éxito"
        );
      } catch (error) {
        toastError(3000, "Error al actualizar el avatar", error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <OvalSpinner />
      </div>
    );
  }

  if (!userData) return <p>No se pudo obtener la data del usuario</p>;

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formRow}>
          <label>Nombre</label>
          <input
            {...register("first_name")}
            className={`${styles.input}`}
            defaultValue={userData?.first_name}
          />
        </div>
        <div className={styles.formCustomError}>
          {errors?.first_name?.message}
        </div>
        <div className={styles.formRow}>
          <label>Apellido</label>
          <input
            {...register("last_name")}
            className={`${styles.input}`}
            defaultValue={userData?.last_name}
          />
        </div>
        <div className={styles.formCustomError}>
          {errors?.last_name?.message}
        </div>
        <div className={styles.formRow}>
          <label>Email</label>
          <input
            {...register("email")}
            className={`${styles.input}`}
            defaultValue={userData?.email}
            disabled
          />
        </div>
        <div className={styles.formRow}>
          <label>Edad</label>
          <input
            {...register("age", { valueAsNumber: true })}
            className={`${styles.input}`}
            defaultValue={userData?.age || ""}
          />
        </div>
        <div className={styles.formRow}>
          <label>Avatar</label>
          <div className={styles.avatarContainer}>
            {avatarUrl ? (
              <Image src={avatarUrl} height={64} width={64} alt="Avatar" />
            ) : (
              <UserProfile size={64} />
            )}
            <CldUploadWidget
              onSuccess={handleUpload}
              uploadPreset={process.env.NEXT_PUBLIC_UPLOAD_PRESET}
              options={{
                cropping: true,
                croppingAspectRatio: 1,
                transformation: [
                  { width: 150, height: 150, crop: "thumb", radius: "max" },
                ],
              }}
            >
              {({ open }) => (
                <a className={styles.avatarButton} onClick={open}>
                  Subir Avatar
                </a>
              )}
            </CldUploadWidget>
          </div>
        </div>
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

export default EditPage;
