import { deleteNotification, markNotificationRead } from "@/server/notifications/inbox";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// PATCH /api/notifications/[id] — marks one notification as read
export async function PATCH(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await markNotificationRead(actor, id);
    return ok({ message: "Notificación marcada como leída" });
  } catch (error) {
    return handleApiError(error, "Error marking notification as read");
  }
}

// DELETE /api/notifications/[id]
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await deleteNotification(actor, id);
    return ok({ message: "Notificación eliminada" });
  } catch (error) {
    return handleApiError(error, "Error deleting notification");
  }
}
