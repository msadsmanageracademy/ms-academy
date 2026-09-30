import { setClassResources } from "@/server/classes/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// PUT /api/classes/[id]/resources { resources: [{ title, url }] } — admin, course classes
export async function PUT(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await setClassResources(actor, id, await readJson(req));
    return ok({ message: "Materiales actualizados" });
  } catch (error) {
    return handleApiError(error, "Error updating class resources");
  }
}
