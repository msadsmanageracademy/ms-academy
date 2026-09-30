import { deleteClass, getClassDetail, updateClass } from "@/server/classes/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// GET /api/classes/[id] — detail; links and materials only for participants with access
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    return ok({ data: await getClassDetail(actor, id) });
  } catch (error) {
    return handleApiError(error, "Error fetching class");
  }
}

// PATCH /api/classes/[id] — admin: edits the content
export async function PATCH(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await updateClass(actor, id, await readJson(req));
    return ok({ message: "Clase actualizada con éxito" });
  } catch (error) {
    return handleApiError(error, "Error updating class");
  }
}

// DELETE /api/classes/[id] — admin: deletes an archived class
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await deleteClass(actor, id);
    return ok({ message: "Clase eliminada con éxito" });
  } catch (error) {
    return handleApiError(error, "Error deleting class");
  }
}
