import { createCourse, listAdminCourses, listCourses } from "@/server/courses/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// GET /api/courses — public catalog (active courses with an open edition);
// ?showAll=true (admin) returns every course card
export async function GET(req) {
  try {
    const actor = await getActor();
    const { searchParams } = new URL(req.url);
    const data =
      searchParams.get("showAll") === "true" ? await listAdminCourses(actor) : await listCourses(actor);
    return ok({ data });
  } catch (error) {
    return handleApiError(error, "Error fetching courses");
  }
}

// POST /api/courses — admin: creates an active course and its Edition 1 (draft)
export async function POST(req) {
  try {
    const actor = await getActor();
    const data = await createCourse(actor, await readJson(req));
    return ok({ message: "Curso creado con éxito", data }, 201);
  } catch (error) {
    return handleApiError(error, "Error creating course");
  }
}
