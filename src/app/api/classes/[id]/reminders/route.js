import { sendClassReminders } from "@/server/classes/reminders";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// POST /api/classes/[id]/reminders { participantIds? } — admin: emails a class reminder
export async function POST(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const data = await sendClassReminders(actor, id, await readJson(req));
    return ok({ message: "Recordatorio enviado", data });
  } catch (error) {
    return handleApiError(error, "Error sending class reminder");
  }
}
