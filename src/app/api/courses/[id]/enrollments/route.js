import { enrollInCourse } from "@/server/courses/enrollments";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// POST /api/courses/[id]/enrollments — the current user pre-enrolls (payment pending)
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await enrollInCourse(actor, id);
    return ok(
      { message: "Pre-inscripción realizada con éxito. Completá el pago para confirmar.", data },
      201,
    );
  } catch (error) {
    return handleApiError(error, "Error enrolling in course");
  }
}
