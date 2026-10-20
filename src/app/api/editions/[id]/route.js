import { deleteEdition, getEditionDetail, updateEdition } from "@/server/courses/editions";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// GET /api/editions/[id] — edition detail; unpublished ones only for admins and enrollees
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    return ok({ data: await getEditionDetail(actor, id) });
  } catch (error) {
    return handleApiError(error, "Error fetching edition");
  }
}

// PATCH /api/editions/[id] { price, max_participants } — admin: only draft editions
export async function PATCH(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await updateEdition(actor, id, await readJson(req));
    return ok({ message: "Edición actualizada con éxito", data });
  } catch (error) {
    return handleApiError(error, "Error updating edition");
  }
}

// DELETE /api/editions/[id] — admin: deletes a draft edition and notifies its enrollees
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await deleteEdition(actor, id);
    return ok({ message: "Edición eliminada con éxito" });
  } catch (error) {
    return handleApiError(error, "Error deleting edition");
  }
}
