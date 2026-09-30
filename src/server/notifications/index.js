import { NOTIFICATION_TEMPLATES } from "./catalog";
import { ObjectId } from "mongodb";
import { prepareNotificationForDB } from "@/models/schemas";

export { displayName } from "./catalog";

const toObjectId = (id) => (id instanceof ObjectId ? id : new ObjectId(String(id)));

/**
 * Builds notification documents from a catalog template, one per recipient.
 * `to` accepts a single id or a list; empty values are ignored.
 */
export function buildNotifications(
  templateKey,
  { to, vars = {}, relatedId, relatedType, actorId, metadata } = {},
) {
  const template = NOTIFICATION_TEMPLATES[templateKey];
  if (!template) throw new Error(`Unknown notification template: ${templateKey}`);

  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  const title = template.title;
  const message = template.message(vars);
  const inferredRelatedType = relatedType ?? templateKey.split(".")[0];

  return recipients.map((userId) =>
    prepareNotificationForDB({
      userId: toObjectId(userId),
      type: template.type,
      title,
      message,
      ...(relatedId ? { relatedId: toObjectId(relatedId) } : {}),
      relatedType: inferredRelatedType,
      ...(actorId ? { actorId: toObjectId(actorId) } : {}),
      ...(metadata ? { metadata } : {}),
    }),
  );
}

/** Inserts the notifications built from a template. Returns how many were created. */
export async function notify(db, templateKey, options) {
  const docs = buildNotifications(templateKey, options);
  if (docs.length === 0) return 0;
  await db.collection("notifications").insertMany(docs);
  return docs.length;
}

/**
 * Inserts several batches at once:
 * notifyMany(db, [["class.enrolled", {...}], ["class.participant_joined", {...}]])
 */
export async function notifyMany(db, entries) {
  const docs = entries.flatMap(([key, options]) => buildNotifications(key, options));
  if (docs.length === 0) return 0;
  await db.collection("notifications").insertMany(docs);
  return docs.length;
}
