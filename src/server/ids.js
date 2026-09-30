import { toObjectId } from "@/server/errors";

export const classObjectId = (id) => toObjectId(id, "ID de clase inválido");
export const courseObjectId = (id) => toObjectId(id, "ID de curso inválido");
export const userObjectId = (id) => toObjectId(id, "ID de usuario inválido");
