import { confirmCoursePayment, removeCourseEnrollment } from "@/server/courses/enrollments";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// PATCH /api/courses/[id]/enrollments/[userId] { paymentStatus: "paid" } — admin confirms
// the payment. A payment gateway webhook (5.1) should call the same service.
export async function PATCH(req, { params }) {
  try {
    const actor = await getActor();
    const { id, userId } = await params;
    const data = await confirmCoursePayment(actor, id, userId, await readJson(req));
    return ok({ message: "Pago confirmado. ¡Inscripción completa!", data });
  } catch (error) {
    return handleApiError(error, "Error confirming payment");
  }
}

// DELETE /api/courses/[id]/enrollments/[userId] — the student cancels, or an admin removes them
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id, userId } = await params;
    await removeCourseEnrollment(actor, id, userId);
    return ok({
      message:
        userId === actor?.id ? "Inscripción cancelada con éxito" : "Participante removido con éxito",
    });
  } catch (error) {
    return handleApiError(error, "Error removing course enrollment");
  }
}
