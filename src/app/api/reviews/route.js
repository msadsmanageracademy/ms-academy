import { listMyReviews } from "@/server/reviews/service";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// GET /api/reviews — reviews left by the current user
export async function GET() {
  try {
    const actor = await getActor();
    return ok({ data: await listMyReviews(actor) });
  } catch (error) {
    return handleApiError(error, "Error fetching user reviews");
  }
}
