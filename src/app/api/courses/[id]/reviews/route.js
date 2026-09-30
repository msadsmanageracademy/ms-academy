import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { listCourseReviews, submitCourseReview } from "@/server/reviews/service";

// GET /api/courses/[id]/reviews — ?series=true includes every iteration of the course
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const series = new URL(req.url).searchParams.get("series") === "true";
    return ok({ data: await listCourseReviews(id, { series }) });
  } catch (error) {
    return handleApiError(error, "Error fetching course reviews");
  }
}

// POST /api/courses/[id]/reviews { rating, comment? } — enrollees who paid
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await submitCourseReview(actor, id, await readJson(req));
    return ok({ message: "Reseña guardada", data });
  } catch (error) {
    return handleApiError(error, "Error saving course review");
  }
}
