import { deleteCourse, getCourseDetail, updateCourse } from "@/server/courses/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// GET /api/courses/[id] — detail; drafts only for admins and enrolled users
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    return ok({ data: await getCourseDetail(actor, id) });
  } catch (error) {
    return handleApiError(error, "Error fetching course");
  }
}

// PATCH /api/courses/[id] — admin: edits the content (status has its own sub-resource)
export async function PATCH(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await updateCourse(actor, id, await readJson(req));
    return ok({ message: "Curso actualizado con éxito" });
  } catch (error) {
    return handleApiError(error, "Error updating course");
  }
}

// DELETE /api/courses/[id] — admin: deletes an archived course
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await deleteCourse(actor, id);
    return ok({ message: "Curso eliminado con éxito" });
  } catch (error) {
    return handleApiError(error, "Error deleting course");
  }
}
