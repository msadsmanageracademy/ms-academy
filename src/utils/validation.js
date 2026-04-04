import { config } from "@/config";
import { z } from "zod";

const { strongPassword } = config;

export const LoginFormSchema = z.object({
  username: z.string().email({ message: "Introduzca un email válido" }).trim(),
  password: z.string().min(1, { message: "Introduzca contraseña" }).trim(),
});

export const RegisterFormSchema = z.object({
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  email: z.string().email({ message: "Ingrese un email válido" }).trim(),
  password: strongPassword
    ? z
        .string()
        .min(8, { message: "Debe contener al menos 8 caracteres" })
        .regex(/\d/, { message: "Debe contener al menos un número" })
        .regex(/[A-Z]/, { message: "Debe contener al menos una mayúscula" })
        .regex(/[!@#$%^&*()_+{}:<>?]/, {
          message: "Debe contener al menos un carácter especial",
        })
        .refine((value) => !/\s/.test(value), {
          message: "No debe contener espacios",
        })
    : z.string().min(3, { message: "Debe contener al menos 3 caracteres" }),
  role: z.enum(["user", "admin"]),
});

export const ContactFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .trim(),
  email: z.string().email({ message: "Ingresá un email válido" }).trim(),
  subject: z
    .string()
    .min(3, { message: "El asunto debe tener al menos 3 caracteres" })
    .trim(),
  message: z
    .string()
    .min(10, { message: "El mensaje debe tener al menos 10 caracteres" })
    .trim(),
});

export const EditAccountFormSchema = RegisterFormSchema.omit({
  email: true,
  password: true,
  role: true,
}).extend({
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  age: z
    .number({ message: "Debe ingresar un número" })
    .nullable()
    .default(null), // TODO: Si se deja vacío al editar, pide que el campo sea un número
});

export const ClassFormSchema = z.object({
  title: z.string().min(3, { message: "Debe contener al menos 3 caracteres" }),
  short_description: z
    .string()
    .min(10, { message: "Debe contener al menos 10 caracteres" }),
  duration: z
    .number({ message: "Debe ingresar un número" })
    .positive({ message: "Debe ingresar 1 o mayor" }),
  start_date: z
    .date({ message: "Debe seleccionar una fecha de inicio" })
    .refine((date) => date > new Date(), {
      message: "Día/horario deben ser posteriores al actual",
    })
    .nullable()
    .optional(),
  max_participants: z
    .number({ message: "Debe ingresar un número" })
    .nonnegative({ message: "Debe ingresar 0 o mayor" })
    .nullable()
    .default(null),
  price: z
    .number({ message: "Debe ingresar un número" })
    .nonnegative({ message: "Debe ingresar 0 o mayor" }),
  courseId: z.string().optional(),
  googleEventId: z.string().optional(),
  googleEventUrl: z.string().optional(),
});

export const CourseFormSchema = z.object({
  title: z.string().min(3, { message: "Debe contener al menos 3 caracteres" }),
  short_description: z
    .string()
    .min(10, { message: "Debe contener al menos 10 caracteres" }),
  full_description: z
    .string()
    .min(10, { message: "Debe contener al menos 10 caracteres" }),
  max_participants: z
    .number({ message: "Debe ingresar un número" })
    .nonnegative({ message: "Debe ingresar 0 o mayor" })
    .nullable()
    .default(null),
  price: z
    .number({ message: "Debe ingresar un número" })
    .nonnegative({ message: "Debe ingresar 0 o mayor" }),
  status: z.enum(["draft", "published"]).optional(),
});

export const AddGoogleInformationToEvent = z.object({
  googleEventId: z.string().min(1),
  googleEventUrl: z.string().min(1),
});

// Schemas for editing published items (restricted fields only)
export const PublishedCourseEditSchema = CourseFormSchema.pick({
  title: true,
  short_description: true,
  full_description: true,
});

export const PublishedClassEditSchema = ClassFormSchema.pick({
  title: true,
  short_description: true,
});

export const ClassResourcesUpdateSchema = z.object({
  resources: z.array(
    z.object({
      title: z.string().min(1, "El título es requerido"),
      url: z.string().url("La URL no es válida"),
    }),
  ),
});

export const ReviewFormSchema = z.object({
  rating: z.number().int().min(1, "Seleccioná una puntuación").max(5),
  comment: z
    .string()
    .max(500, "El comentario no puede superar 500 caracteres")
    .optional(),
});
