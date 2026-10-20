import { enrollInEdition, listEditionEnrollments } from "@/server/courses/enrollments";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// GET /api/editions/[id]/enrollments — admin: enrollees with contact data and payment status
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    return ok({ data: await listEditionEnrollments(actor, id) });
  } catch (error) {
    return handleApiError(error, "Error listing edition enrollments");
  }
}

// POST /api/editions/[id]/enrollments — the current user pre-enrolls (payment pending)
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await enrollInEdition(actor, id);
    return ok(
      { message: "Pre-inscripción realizada con éxito. Completá el pago para confirmar.", data },
      201,
    );
  } catch (error) {
    return handleApiError(error, "Error enrolling in edition");
  }
}
