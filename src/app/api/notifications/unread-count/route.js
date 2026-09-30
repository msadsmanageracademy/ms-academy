import { countUnread } from "@/server/notifications/inbox";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// GET /api/notifications/unread-count — { data: { count } }
export async function GET() {
  try {
    const actor = await getActor();
    return ok({ data: { count: await countUnread(actor) } });
  } catch (error) {
    return handleApiError(error, "Error fetching unread count");
  }
}
