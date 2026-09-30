import { HttpError } from "@/server/errors";
import {
  deleteReadNotifications,
  listNotifications,
  markAllNotificationsRead,
} from "@/server/notifications/inbox";
import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";

// GET /api/notifications?page= — the current user's notifications, newest first
export async function GET(req) {
  try {
    const actor = await getActor();
    const page = new URL(req.url).searchParams.get("page");
    const { items, pagination } = await listNotifications(actor, { page });
    return ok({ data: items, pagination });
  } catch (error) {
    return handleApiError(error, "Error fetching notifications");
  }
}

// PATCH /api/notifications { read: true } — marks every notification as read
export async function PATCH(req) {
  try {
    const actor = await getActor();
    const body = await readJson(req);
    if (body.read !== true) throw new HttpError(400, "Solo se pueden marcar como leídas");
    const modifiedCount = await markAllNotificationsRead(actor);
    return ok({ message: "Todas las notificaciones marcadas como leídas", data: { modifiedCount } });
  } catch (error) {
    return handleApiError(error, "Error marking notifications as read");
  }
}

// DELETE /api/notifications — deletes the current user's read notifications
export async function DELETE() {
  try {
    const actor = await getActor();
    const deletedCount = await deleteReadNotifications(actor);
    return ok({ message: `${deletedCount} notificaciones eliminadas`, data: { deletedCount } });
  } catch (error) {
    return handleApiError(error, "Error deleting notifications");
  }
}
