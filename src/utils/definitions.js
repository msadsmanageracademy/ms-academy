import { z } from "zod";

export const LoginFormSchema = z.object({
  username: z.string().email({ message: "Introduzca un email válido" }).trim(),
  password: z
    .string()
    .min(1, { message: "Introduzca contraseña" })
    // Resta definir si validaré formato previo a enviar solicitud al BE
    // También definir si informaté al usuario de posibles errores en el formato
    .trim(),
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
  avatar: z
    .instanceof(File)
    .optional()
    .refine((file) => file.size <= 2 * 1024 * 1024, {
      message: "El tamaño del archivo debe ser menor a 2MB", // Consultar a Martín
    }),
});

export const experimentalDesignNameFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Ingrese el nombre de su diseño experimental" }),
});

export const responseVariableFormSchema = z.object({
  response_variable: z
    .string()
    .min(1, { message: "Ingrese la variable respuesta" }),
});

export const explanatoryVariablesFormSchema = z.object({
  explanatory_variable_1: z
    .string()
    .min(1, { message: "Ingrese el primer factor" })
    .optional(),
  explanatory_variable_2: z
    .string()
    .min(1, { message: "Ingrese el segundo factor" })
    .optional(),
  explanatory_variable_3: z
    .string()
    .min(1, { message: "Ingrese el tercer factor" })
    .optional(),
});

export const explanatoryVariableLevelsFormSchema = z.object({
  explanatory_variable_level_11: z
    .string()
    .min(1, { message: "Ingrese primera categoría" })
    .optional(),
  explanatory_variable_level_12: z
    .string()
    .min(1, { message: "Ingrese segunda categoría" })
    .optional(),
  explanatory_variable_level_13: z
    .string()
    .min(1, { message: "Ingrese tercera categoría" })
    .optional(),
  explanatory_variable_level_14: z
    .string()
    .min(1, { message: "Ingrese cuarta categoría" })
    .optional(),
  explanatory_variable_level_15: z
    .string()
    .min(1, { message: "Ingrese quinta categoría" })
    .optional(),
  explanatory_variable_level_21: z
    .string()
    .min(1, { message: "Ingrese primera categoría" })
    .optional(),
  explanatory_variable_level_22: z
    .string()
    .min(1, { message: "Ingrese segunda categoría" })
    .optional(),
  explanatory_variable_level_23: z
    .string()
    .min(1, { message: "Ingrese tercera categoría" })
    .optional(),
  explanatory_variable_level_24: z
    .string()
    .min(1, { message: "Ingrese cuarta categoría" })
    .optional(),
  explanatory_variable_level_25: z
    .string()
    .min(1, { message: "Ingrese quinta categoría" })
    .optional(),
  explanatory_variable_level_31: z
    .string()
    .min(1, { message: "Ingrese primera categoría" })
    .optional(),
  explanatory_variable_level_32: z
    .string()
    .min(1, { message: "Ingrese segunda categoría" })
    .optional(),
  explanatory_variable_level_33: z
    .string()
    .min(1, { message: "Ingrese tercera categoría" })
    .optional(),
  explanatory_variable_level_34: z
    .string()
    .min(1, { message: "Ingrese cuarta categoría" })
    .optional(),
  explanatory_variable_level_35: z
    .string()
    .min(1, { message: "Ingrese quinta categoría" })
    .optional(),
});

export const biologicalReplicatesFormSchema = z.object({
  sampling_unit: z
    .string()
    .min(1, { message: "Complete con la unidad muestral" }),
  biological_replicates: z
    .number({ message: "Ingrese un número" })
    .gte(3, { message: "La cantidad mínima es 3" })
    .min(1, { message: "Ingrese la cantidad de réplicas biológicas" }),
  technical_replicates: z
    .number({ message: "Ingrese un número" })
    .positive({ message: "Ingrese un número mayor a 0" })
    .min(1, { message: "Ingrese la cantidad de réplicas técnicas" }),
  total_repetitions: z
    .number({ message: "Ingrese un número" })
    .positive({ message: "Ingrese un número mayor a 0" })
    .min(1, { message: "Ingrese la cantidad de repeticiones totales" }),
});
