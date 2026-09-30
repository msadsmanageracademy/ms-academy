import { cloneCourse } from "@/server/courses/service";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// POST /api/courses/[id]/clone — admin: new draft iteration of the course and its classes
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await cloneCourse(actor, id);
    return ok({ message: "Curso clonado con éxito", data }, 201);
  } catch (error) {
    return handleApiError(error, "Error cloning course");
  }
}
