import { z } from "zod";

export const LoginFormSchema = z.object({
  username: z.string().email({ message: "Introduzca un email válido" }).trim(),
  password: z.string().min(1, { message: "Introduzca contraseña" }).trim(),
});

export const RegisterFormSchema = z.object({
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
      message: "No debe contener espacios",
    }),
  role: z.enum(["user", "admin"]),
});

/* Para el avatar:
  z.union() en Zod permite que un campo pueda tener múltiples tipos de valores válidos (en este caso url o "").
  z.string().url() valida que, si hay un valor, sea una URL válida.
  z.literal("") permite que el valor sea una cadena vacía ("") */

export const EditAccountFormSchema = RegisterFormSchema.omit({
  email: true,
  password: true,
  role: true,
}).extend({
  first_name: z.string().trim().optional(), // TODO: Al dejarlo vacío, se guarda como "". Lo ideal sería que se guarde como null
  last_name: z.string().trim().optional(), // TODO: Al dejarlo vacío, se guarda como "". Lo ideal sería que se guarde como null
  age: z
    .number({ message: "Debe ingresar un número" })
    .nullable()
    .default(null), // TODO: Si se deja vacío al editar, pide que el campo sea un número
  // avatarUrl: z.union([z.string().url(), z.literal("")]).optional(),
  // avatarPublicId: z.union([z.string().url(), z.literal("")]).optional(),
});

export const EventFormSchema = z.object({
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
  start_date: z.date(), // TODO: Si el campo queda vacío obtengo error en FE al editar curso
  end_date: z.date().optional(), // TODO: Si el campo queda vacío obtengo error en FE al editar curso
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
  googleEventId: z.string().optional(),
  googleEventUrl: z.string().optional(),
});

export const EditEventFormSchema = EventFormSchema.omit({
  type: true,
  googleEventId: true,
  googleEventUrl: true,
});

export const AddGoogleInformationToEvent = z.object({
  googleEventId: z.string().min(1),
  googleEventUrl: z.string().min(1),
});
