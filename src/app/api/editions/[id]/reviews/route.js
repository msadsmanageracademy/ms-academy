import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { listEditionReviews, submitEditionReview } from "@/server/reviews/service";
import { ReviewPageQuerySchema } from "@/utils/validation";

// GET /api/editions/[id]/reviews?page= — one page of the edition's reviews, newest first
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { page } = ReviewPageQuerySchema.parse({
      page: new URL(req.url).searchParams.get("page") ?? undefined,
    });
    return ok({ data: await listEditionReviews(id, { page }) });
  } catch (error) {
    return handleApiError(error, "Error fetching edition reviews");
  }
}

// POST /api/editions/[id]/reviews { rating, comment? } — paid enrollees, once the edition ended
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await submitEditionReview(actor, id, await readJson(req));
    return ok({ message: "Reseña guardada", data });
  } catch (error) {
    return handleApiError(error, "Error saving edition review");
  }
}
