"use client";

// import { useSession } from "@/context/SessionContext";
import { LoginFormSchema } from "@/utils/definitions";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastError } from "@/utils/alerts";
import { useForm } from "react-hook-form";
import styles from "./styles.module.css";
import axios from "axios";

const LoginForm = () => {
  // const { login } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm({
    resolver: zodResolver(LoginFormSchema),
  });

  const validateForm = async () => {
    const isFormValidated = await trigger();

    console.log(isFormValidated);

    console.log(errors);

    if (!isFormValidated) {
      toastError(3000, "Error en el formulario", "Intente nuevamente");
      return;
    }

    // Solo llamar a handleSubmit si la validación es exitosa
    handleSubmit(onSubmit)();
  };

  const onSubmit = async (data) => {
    try {
      // const { username, password } = data;

      // const apiURL = process.env.NEXT_PUBLIC_API_URL;

      // const response = await axios.post(`${apiURL}/api/user/login`, {
      //   username,
      //   password,
      // });

      // Como uso axios, entiendo que si hubo error (HTTP fuera del rango 200 - 299) va a entrar automáticamente al catch.
      // Teniendo esto en cuenta, no sería necesario analizar el status de response.

      const response = {
        status: "success",
        data: {
          first_name: "admin",
          last_name: "admin",
          token:
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0L2FwaS91c2VyL2xvZ2luIiwiaWF0IjoxNzI1NzUwODU3LCJleHAiOjE3MjU4MzcyNTcsIm5iZiI6MTcyNTc1MDg1NywianRpIjoieFJpejhuMmROaUU3aTJHayIsInN1YiI6IjEiLCJwcnYiOiIyYjFjOTQyY2VjM2FmMjFiNWQ3OTVjM2M1NDM2YzY1ODg0M2U3NjU1In0.dVYQh4L8-3g-jpCYMxA9HujArINb8SvQT5peyPzfuFo",
        },
        message: "SUCCESSFULL_LOGIN",
      };

      if (response.status === "success") {
        // Puede que elimine el if por lo explicado más arriba
        const {
          data: { first_name, last_name, token },
        } = response;

        login({ first_name, last_name, token }); // Ejecuto login (del context) para actualizar la session en CONTEXT API
      }
    } catch (err) {
      // const response = {
      //   status: "error",
      //   message: "INVALID_PASSWORD",
      // };
      // const response = {
      //   status: "error",
      //   message: "USER_NOT_FOUND",
      // };

      const { message } = response;

      // Manejar error

      if (message == "INVALID_PASSWORD")
        toastError(
          3000,
          "Error al iniciar sesión",
          "La contraseña no es correcta, intente nuevamente"
        );
      if (message == "USER_NOT_FOUND")
        toastError(
          3000,
          "Error al iniciar sesión",
          "El usuario no existe, ¿desea registrarse?"
        );
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formRow}>
          <input
            type="text"
            name="username"
            placeholder="Usuario"
            {...register("username")}
          />
        </div>
        <div className={styles.formCustomError}>
          {errors?.username?.message}
        </div>
        <div className={styles.formRow}>
          <input
            type="text"
            name="password"
            placeholder="Contraseña"
            {...register("password")}
          />
        </div>
        <div className={styles.formCustomError}>
          {errors?.password?.message}
        </div>
        <button
          value="Iniciar sesión"
          className="button-primary"
          onClick={validateForm}
        >
          Iniciar sesión
        </button>
      </form>
    </>
  );
};

export default LoginForm;
