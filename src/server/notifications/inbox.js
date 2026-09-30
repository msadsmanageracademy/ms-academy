// The current user's notification inbox. Every query is scoped to the actor's own
// notifications, so nobody can read or change someone else's.
import { getDb } from "@/lib/db";
import { HttpError, assertUser, toObjectId } from "@/server/errors";

const PAGE_SIZE = 10;

async function inbox(actor) {
  assertUser(actor);
  return { collection: (await getDb()).collection("notifications"), userId: toObjectId(actor.id) };
}

const notificationId = (id) => toObjectId(id, "ID de notificación inválido");

/** Page of notifications, newest first. Returns { items, pagination }. */
export async function listNotifications(actor, { page: rawPage } = {}) {
  const { collection, userId } = await inbox(actor);
  const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
  const [items, total] = await Promise.all([
    collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
    collection.countDocuments({ userId }),
  ]);
  return {
    items,
    pagination: { page, limit: PAGE_SIZE, total, pages: Math.ceil(total / PAGE_SIZE) },
  };
}

export async function countUnread(actor) {
  const { collection, userId } = await inbox(actor);
  return collection.countDocuments({ userId, read: false });
}

export async function markNotificationRead(actor, id) {
  const { collection, userId } = await inbox(actor);
  const result = await collection.updateOne({ _id: notificationId(id), userId }, { $set: { read: true } });
  if (result.matchedCount === 0) throw new HttpError(404, "Notificación no encontrada");
}

/** Returns the number of notifications marked as read. */
export async function markAllNotificationsRead(actor) {
  const { collection, userId } = await inbox(actor);
  return (await collection.updateMany({ userId, read: false }, { $set: { read: true } })).modifiedCount;
}

export async function deleteNotification(actor, id) {
  const { collection, userId } = await inbox(actor);
  const result = await collection.deleteOne({ _id: notificationId(id), userId });
  if (result.deletedCount === 0) throw new HttpError(404, "Notificación no encontrada");
}

/** Deletes the read notifications. Returns how many were deleted. */
export async function deleteReadNotifications(actor) {
  const { collection, userId } = await inbox(actor);
  return (await collection.deleteMany({ userId, read: true })).deletedCount;
}
