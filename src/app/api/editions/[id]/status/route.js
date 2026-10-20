import { setEditionStatus } from "@/server/courses/editions";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// PUT /api/editions/[id]/status { status: "draft" | "published" } — admin
export async function PUT(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await setEditionStatus(actor, id, await readJson(req));
    return ok({ message: "Estado actualizado", data });
  } catch (error) {
    return handleApiError(error, "Error updating edition status");
  }
}
