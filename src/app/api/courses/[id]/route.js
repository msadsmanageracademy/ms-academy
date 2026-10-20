import { deleteCourse, getCourseDetail, setCourseStatus, updateCourse } from "@/server/courses/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// A body with `status` and nothing else changes the course status
const isStatusOnly = (body) =>
  body !== null && typeof body === "object" && !Array.isArray(body) && Object.keys(body).join() === "status";

// GET /api/courses/[id] — course, its open edition and course-wide ratings
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    return ok({ data: await getCourseDetail(actor, id) });
  } catch (error) {
    return handleApiError(error, "Error fetching course");
  }
}

// PATCH /api/courses/[id] — admin: edits the content, or { status } alone archives /
// reactivates it (status mixed with other fields → 400)
export async function PATCH(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const body = await readJson(req);
    if (isStatusOnly(body)) {
      const data = await setCourseStatus(actor, id, body);
      return ok({ message: "Estado actualizado", data });
    }
    await updateCourse(actor, id, body);
    return ok({ message: "Curso actualizado con éxito" });
  } catch (error) {
    return handleApiError(error, "Error updating course");
  }
}

// DELETE /api/courses/[id] — admin: deletes a course without enrollments
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
