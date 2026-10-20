import { getEditionLabels, getEditionTimeStatusFromClasses } from "@/server/courses/queries";
import { notifyMany } from "@/server/notifications";
import { HttpError, toObjectId } from "@/server/errors";
import { editionName } from "@/utils/courseEditions";

// Single source of truth for linking/unlinking a class to/from a course edition.
// Used by PUT/DELETE /api/classes/[id]/edition and POST /api/classes (editionId on create).
// Both run inside a transaction: `tx` is the context given by withTransaction().

const enrolleeIdsOf = async ({ db, session }, editionId) =>
  (
    await db
      .collection("courseEnrollments")
      .find({ editionId }, { projection: { userId: 1 }, session })
      .toArray()
  ).map((e) => e.userId);

// "Curso · Septiembre 2026" for the notifications. The label depends on the classes of
// the edition, so callers pick the moment: after linking, before unlinking.
async function editionTitleOf({ db, session }, edition) {
  const [course, labels] = await Promise.all([
    db.collection("courses").findOne({ _id: edition.courseId }, { projection: { title: 1 }, session }),
    getEditionLabels(db, [edition.courseId], { session }),
  ]);
  return editionName(course?.title ?? "Curso", labels.get(edition._id.toString())?.label);
}

/**
 * Links a class to an edition:
 * - the class becomes "enrolled" with no own capacity nor stored participants:
 *   its participants are the edition enrollees (see ./audience.js)
 * - the enrollees are notified; pending ones don't see links/materials until they pay
 * - a published edition that had already finished goes back to draft, since a new
 *   class invalidates its "completed" state
 * The edition document is written in the transaction, so a concurrent deletion of the
 * edition conflicts with the link instead of leaving an orphan class.
 */
export async function assignClassToEdition(tx, classItem, editionIdRaw) {
  const { db, session, afterCommit } = tx;
  const editionId = toObjectId(editionIdRaw, "editionId inválido");
  if (classItem.status === "published") {
    throw new HttpError(400, "No se puede vincular una clase publicada a una edición");
  }
  if (classItem.editionId) {
    throw new HttpError(
      400,
      "La clase ya pertenece a una edición. Desvinculala antes de asignarla a otra.",
    );
  }

  const edition = await db
    .collection("courseEditions")
    .findOneAndUpdate(
      { _id: editionId },
      { $set: { updatedAt: new Date() } },
      { projection: { courseId: 1, status: 1 }, session },
    );
  if (!edition) throw new HttpError(404, "Edición no encontrada");

  // The filter re-checks the class state, so a concurrent change aborts the link
  const result = await db.collection("classes").updateOne(
    { _id: classItem._id, editionId: { $exists: false }, status: { $ne: "published" } },
    {
      $set: { editionId, status: "enrolled", max_participants: null, updatedAt: new Date() },
      $unset: { participants: "" },
    },
    { session },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(409, "La clase cambió mientras se vinculaba. Volvé a intentarlo.");
  }
  // Named with the class already in it (it may set the edition's first date)
  const courseTitle = await editionTitleOf(tx, edition);

  if (edition.status === "published") {
    const timeStatus = await getEditionTimeStatusFromClasses(db, editionId, "published", {
      excludeClassId: classItem._id,
      session,
    });
    if (timeStatus === "completed") {
      await db
        .collection("courseEditions")
        .updateOne({ _id: editionId }, { $set: { status: "draft", updatedAt: new Date() } }, { session });
    }
  }

  const enrolleeIds = await enrolleeIdsOf(tx, editionId);
  const common = {
    vars: { classTitle: classItem.title, courseTitle },
    relatedId: classItem._id,
    actorId: classItem.createdBy,
  };
  afterCommit(() =>
    notifyMany(db, [
      ["class.linked_to_course", { ...common, to: classItem.createdBy }],
      ["class.added_to_course", { ...common, to: enrolleeIds }],
    ]),
  );
}

/**
 * Unlinks a class from its edition:
 * - the class goes back to a standalone draft with no participants (the edition
 *   enrollees are notified that it left the course)
 * - a published edition left without classes goes back to draft
 */
export async function unassignClassFromEdition(tx, classItem) {
  const { db, session, afterCommit } = tx;
  if (!classItem.editionId) throw new HttpError(400, "La clase no pertenece a ninguna edición");

  const editionId = classItem.editionId;
  const edition = await db
    .collection("courseEditions")
    .findOne({ _id: editionId }, { projection: { courseId: 1, status: 1 }, session });
  // Named before the class leaves it (the name students know it by)
  const courseTitle = edition ? await editionTitleOf(tx, edition) : "";

  const result = await db.collection("classes").updateOne(
    { _id: classItem._id, editionId },
    { $set: { status: "draft", participants: [], updatedAt: new Date() }, $unset: { editionId: "" } },
    { session },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(409, "La clase cambió mientras se desvinculaba. Volvé a intentarlo.");
  }

  if (edition?.status === "published") {
    const remaining = await db.collection("classes").countDocuments({ editionId }, { session });
    if (remaining === 0) {
      await db
        .collection("courseEditions")
        .updateOne({ _id: editionId }, { $set: { status: "draft", updatedAt: new Date() } }, { session });
    }
  }

  const enrolleeIds = await enrolleeIdsOf(tx, editionId);
  const common = {
    vars: { classTitle: classItem.title, courseTitle },
    relatedId: classItem._id,
    actorId: classItem.createdBy,
  };
  afterCommit(() =>
    notifyMany(db, [
      ["class.unlinked_from_course", { ...common, to: classItem.createdBy }],
      ["class.removed_from_course", { ...common, to: enrolleeIds }],
    ]),
  );
}
