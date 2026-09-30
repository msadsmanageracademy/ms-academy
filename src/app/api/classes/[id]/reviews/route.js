import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { listClassReviews, submitClassReview } from "@/server/reviews/service";

// GET /api/classes/[id]/reviews — reviews of a class, newest first
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    return ok({ data: await listClassReviews(id) });
  } catch (error) {
    return handleApiError(error, "Error fetching class reviews");
  }
}

// POST /api/classes/[id]/reviews { rating, comment? } — participants, once the class ended
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await submitClassReview(actor, id, await readJson(req));
    return ok({ message: "Reseña guardada", data });
  } catch (error) {
    return handleApiError(error, "Error saving class review");
  }
}
