import { createClass, listClasses } from "@/server/classes/service";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// GET /api/classes — public catalog; ?myClasses=true (user), ?showAll=true or ?editionId= (admin)
export async function GET(req) {
  try {
    const actor = await getActor();
    const { searchParams } = new URL(req.url);
    const data = await listClasses(actor, {
      editionId: searchParams.get("editionId"),
      showAll: searchParams.get("showAll") === "true",
      myClasses: searchParams.get("myClasses") === "true",
    });
    return ok({ data });
  } catch (error) {
    return handleApiError(error, "Error fetching classes");
  }
}

// POST /api/classes — admin: creates a draft class (optionally linked to an edition)
export async function POST(req) {
  try {
    const actor = await getActor();
    const data = await createClass(actor, await readJson(req));
    return ok({ message: "Clase creada con éxito", data }, 201);
  } catch (error) {
    return handleApiError(error, "Error creating class");
  }
}
