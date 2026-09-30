import { setCourseStatus } from "@/server/courses/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// PUT /api/courses/[id]/status { status: "draft" | "published" } — admin
export async function PUT(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await setCourseStatus(actor, id, await readJson(req));
    return ok({ message: "Estado actualizado", data });
  } catch (error) {
    return handleApiError(error, "Error updating course status");
  }
}
