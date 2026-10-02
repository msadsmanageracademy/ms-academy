"use server";

// Server Actions for courses: thin wrappers over the same services as the REST API.
// Authorization lives in the services (they receive the acting user).
import { actionResult } from "./result";
import { getActor } from "@/lib/api/guards";
import { revalidatePath } from "next/cache";
import { cloneCourse, deleteCourse, setCourseStatus } from "@/server/courses/service";
import {
  confirmCoursePayment,
  enrollInCourse,
  removeCourseEnrollment,
} from "@/server/courses/enrollments";

// Re-renders the page that called the action with fresh data (see classes.js)
const refreshPages = () => revalidatePath("/", "layout");

const run = (context, body) =>
  actionResult(context, async () => {
    const result = await body(await getActor());
    refreshPages();
    return result;
  });

export async function enrollInCourseAction(courseId) {
  return run("Error enrolling in course", async (actor) => ({
    message: "Pre-inscripción realizada con éxito. Completá el pago para confirmar.",
    data: await enrollInCourse(actor, courseId),
  }));
}

/** The current user cancels their own (unpaid) enrollment. */
export async function cancelCourseEnrollmentAction(courseId) {
  return run("Error cancelling course enrollment", async (actor) => {
    await removeCourseEnrollment(actor, courseId, actor?.id);
    return { message: "Inscripción cancelada con éxito" };
  });
}

export async function removeCourseEnrollmentAction(courseId, userId) {
  return run("Error removing course enrollment", async (actor) => {
    await removeCourseEnrollment(actor, courseId, userId);
    return { message: "Participante removido con éxito" };
  });
}

export async function confirmCoursePaymentAction(courseId, userId) {
  return run("Error confirming payment", async (actor) => ({
    message: "Pago confirmado. ¡Inscripción completa!",
    data: await confirmCoursePayment(actor, courseId, userId, { paymentStatus: "paid" }),
  }));
}

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

export async function cloneCourseAction(courseId) {
  return run("Error cloning course", async (actor) => ({
    message: "Curso clonado con éxito",
    data: await cloneCourse(actor, courseId),
  }));
}
