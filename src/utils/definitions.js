import { z } from "zod";

export const LoginFormSchema = z.object({
  username: z.string().email({ message: "Introduzca un email válido" }).trim(),
  password: z.string().min(1, { message: "Introduzca contraseña" }).trim(),
});

export const RegisterFormSchema = z.object({
  first_name: z.string().min(1, { message: "Ingrese su nombre" }).trim(),
  last_name: z.string().min(1, { message: "Ingrese su apellido" }).trim(),
  email: z.string().email({ message: "Ingrese un email válido" }).trim(),
  password: z
    .string()
    .min(8, { message: "Debe contener al menos 8 caracteres" })
    .regex(/\d/, { message: "Debe contener al menos un número" })
    .regex(/[A-Z]/, { message: "Debe contener al menos una mayúscula" })
    .regex(/[!@#$%^&*()_+{}:<>?]/, {
      message: "Debe contener al menos un carácter especial",
    })
    .refine((value) => !/\s/.test(value), {
      message: "No debe contener espacios", // Chequear
    }),
});

export const eventMongoSchema = z.object({
  type: z.enum(["class", "course"]),
  title: z.string().min(3, { message: "Debe contener al menos 3 caracteres" }),
  short_description: z
    .string()
    .min(10, { message: "Debe contener al menos 10 caracteres" }),
  full_description: z
    .string()
    .min(10, { message: "Debe contener al menos 10 caracteres" })
    .optional(),
  duration: z
    .number({ message: "Debe ingresar un número" })
    .positive({ message: "Debe ingresar 1 o mayor" }),
  start_date: z.date(),
  end_date: z.date().optional(),
  participants: z.array(z.string()).default([]),
  amount_of_classes: z
    .number({ message: "Debe ingresar un número" })
    .min(2, { message: "Debe haber al menos 2 clases" })
    .optional(),
  max_participants: z
    .number({ message: "Debe ingresar un número" })
    .nonnegative({ message: "Debe ingresar 0 o mayor" }),
  price: z
    .number({ message: "Debe ingresar un número" })
    .nonnegative({ message: "Debe ingresar 0 o mayor" }),
});
