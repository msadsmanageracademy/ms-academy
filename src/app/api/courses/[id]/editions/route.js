import { getAdminCourse } from "@/server/courses/service";
import { createEdition } from "@/server/courses/editions";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// GET /api/courses/[id]/editions — admin: every edition of the course with its counts
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const { editions } = await getAdminCourse(actor, id);
    return ok({ data: editions });
  } catch (error) {
    return handleApiError(error, "Error listing course editions");
  }
}

// POST /api/courses/[id]/editions — admin: creates a new edition (draft) from the most recently created one
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await createEdition(actor, id);
    return ok({ message: "Edición creada con éxito", data }, 201);
  } catch (error) {
    return handleApiError(error, "Error creating course edition");
  }
}
