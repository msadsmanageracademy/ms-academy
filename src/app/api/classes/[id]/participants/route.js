import { enrollInClass, listClassParticipants } from "@/server/classes/participants";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// GET /api/classes/[id]/participants — admin: participants with their contact data
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    return ok({ data: await listClassParticipants(actor, id) });
  } catch (error) {
    return handleApiError(error, "Error listing class participants");
  }
}

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
