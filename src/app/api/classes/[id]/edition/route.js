import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { linkClassToEdition, unlinkClassFromEdition } from "@/server/classes/service";

// PUT /api/classes/[id]/edition { editionId } — admin: links the class to an edition
export async function PUT(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await linkClassToEdition(actor, id, await readJson(req));
    return ok({ message: "Clase vinculada a la edición", data });
  } catch (error) {
    return handleApiError(error, "Error linking class to edition");
  }
}

// DELETE /api/classes/[id]/edition — admin: unlinks the class from its edition
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await unlinkClassFromEdition(actor, id);
    return ok({ message: "Clase desvinculada de la edición", data });
  } catch (error) {
    return handleApiError(error, "Error unlinking class from edition");
  }
}
