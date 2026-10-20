"use server";

// Server Actions for courses and their editions: thin wrappers over the same services
// as the REST API. Authorization lives in the services (they receive the acting user).
import { actionResult } from "./result";
import { getActor } from "@/lib/api/guards";
import { revalidatePath } from "next/cache";
import { deleteCourse, setCourseStatus } from "@/server/courses/service";
import { createEdition, deleteEdition, setEditionStatus } from "@/server/courses/editions";
import {
  confirmEditionPayment,
  enrollInEdition,
  removeEditionEnrollment,
} from "@/server/courses/enrollments";

// Re-renders the page that called the action with fresh data (see classes.js)
const refreshPages = () => revalidatePath("/", "layout");

const run = (context, body) =>
  actionResult(context, async () => {
    const result = await body(await getActor());
    refreshPages();
    return result;
  });

// ---------- Course ----------

/** Archives ("archived") or reactivates ("active") a course. */
export async function setCourseStatusAction(courseId, status) {
  return run("Error updating course status", async (actor) => ({
    message: "Estado actualizado",
    data: await setCourseStatus(actor, courseId, { status }),
  }));
}

export async function deleteCourseAction(courseId) {
  return run("Error deleting course", async (actor) => {
    await deleteCourse(actor, courseId);
    return { message: "Curso eliminado con éxito" };
  });
}

// ---------- Editions ----------

/** Creates a new edition of the course (draft). Returns { _id }. */
export async function createEditionAction(courseId) {
  return run("Error creating course edition", async (actor) => ({
    message: "Edición creada con éxito",
    data: await createEdition(actor, courseId),
  }));
}

export async function setEditionStatusAction(editionId, status) {
  return run("Error updating edition status", async (actor) => ({
    message: "Estado actualizado",
    data: await setEditionStatus(actor, editionId, { status }),
  }));
}

export async function deleteEditionAction(editionId) {
  return run("Error deleting edition", async (actor) => {
    await deleteEdition(actor, editionId);
    return { message: "Edición eliminada con éxito" };
  });
}

// ---------- Enrollments ----------

export async function enrollInEditionAction(editionId) {
  return run("Error enrolling in edition", async (actor) => ({
    message: "Pre-inscripción realizada con éxito. Completá el pago para confirmar.",
    data: await enrollInEdition(actor, editionId),
  }));
}

/** The current user cancels their own (unpaid) enrollment. */
export async function cancelEditionEnrollmentAction(editionId) {
  return run("Error cancelling edition enrollment", async (actor) => {
    await removeEditionEnrollment(actor, editionId, actor?.id);
    return { message: "Inscripción cancelada con éxito" };
  });
}

export async function removeEditionEnrollmentAction(editionId, userId) {
  return run("Error removing edition enrollment", async (actor) => {
    await removeEditionEnrollment(actor, editionId, userId);
    return { message: "Participante removido con éxito" };
  });
}

export async function confirmEditionPaymentAction(editionId, userId) {
  return run("Error confirming payment", async (actor) => ({
    message: "Pago confirmado. ¡Inscripción completa!",
    data: await confirmEditionPayment(actor, editionId, userId, { paymentStatus: "paid" }),
  }));
}
