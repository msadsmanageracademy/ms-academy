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
  title: z.string().min(3),
  description: z.string().optional(),
  duration: z.number().positive(),
  date: z.date(),
  participants: z.array(z.string()).default([]),
  amount_of_classes: z.number().positive().optional(),
  max_participants: z.number().positive(),
  price: z.number().nonnegative(),
});
