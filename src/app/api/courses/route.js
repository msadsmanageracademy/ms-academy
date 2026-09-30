import { createCourse, listCourses } from "@/server/courses/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// GET /api/courses — published courses; ?showAll=true (admin) includes drafts
export async function GET(req) {
  try {
    const actor = await getActor();
    const { searchParams } = new URL(req.url);
    const data = await listCourses(actor, { showAll: searchParams.get("showAll") === "true" });
    return ok({ data });
  } catch (error) {
    return handleApiError(error, "Error fetching courses");
  }
}

// POST /api/courses — admin: creates a draft course
export async function POST(req) {
  try {
    const actor = await getActor();
    const data = await createCourse(actor, await readJson(req));
    return ok({ message: "Curso creado con éxito", data }, 201);
  } catch (error) {
    return handleApiError(error, "Error creating course");
  }
}
