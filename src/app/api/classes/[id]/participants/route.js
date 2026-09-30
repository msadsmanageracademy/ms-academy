import { enrollInClass } from "@/server/classes/participants";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// POST /api/classes/[id]/participants — the current user enrolls in a standalone class
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await enrollInClass(actor, id);
    return ok({ message: "Inscripción realizada con éxito" }, 201);
  } catch (error) {
    return handleApiError(error, "Error enrolling in class");
  }
}
