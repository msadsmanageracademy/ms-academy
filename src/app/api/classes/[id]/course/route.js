import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { linkClassToCourse, unlinkClassFromCourse } from "@/server/classes/service";

// PUT /api/classes/[id]/course { courseId } — admin: links the class to a course
export async function PUT(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await linkClassToCourse(actor, id, await readJson(req));
    return ok({ message: "Clase vinculada al curso", data });
  } catch (error) {
    return handleApiError(error, "Error linking class to course");
  }
}

// DELETE /api/classes/[id]/course — admin: unlinks the class from its course
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await unlinkClassFromCourse(actor, id);
    return ok({ message: "Clase desvinculada del curso", data });
  } catch (error) {
    return handleApiError(error, "Error unlinking class from course");
  }
}
