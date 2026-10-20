// Pure business rules of courses and editions. Each *Error function returns null when the
// operation is allowed, or the (user-facing, Spanish) message of the error otherwise.

const hasDate = (cls) => cls.start_date !== null && cls.start_date !== undefined;
const time = (date) => new Date(date).getTime();

/**
 * Publishing needs an active course and at least one class, all with a date and the
 * first one still in the future. Returns the first unmet condition.
 */
export function publishEditionError({ courseStatus, classes, now = new Date() }) {
  if (courseStatus === "archived") return "No se puede publicar una edición de un curso archivado";
  if (classes.length === 0) {
    return "No se puede publicar una edición sin clases asignadas. Asignale al menos una clase primero.";
  }
  const missingDateCount = classes.filter((cls) => !hasDate(cls)).length;
  if (missingDateCount > 0) {
    return `No se puede publicar: ${missingDateCount} clase(s) no tienen fecha asignada`;
  }
  const earliest = Math.min(...classes.map((cls) => time(cls.start_date)));
  if (earliest <= time(now)) return "No se puede publicar una edición cuya primera clase ya comenzó";
  return null;
}

/** An edition in progress cannot go back to draft. */
export function unpublishEditionError({ timeStatus }) {
  return timeStatus === "in-progress"
    ? "No se puede despublicar una edición que está en curso en este momento"
    : null;
}

/** A course cannot be archived while one of its editions is published and upcoming or in progress. */
export function archiveCourseError({ editions }) {
  const live = editions.some(
    (e) => e.status === "published" && (e.timeStatus === "upcoming" || e.timeStatus === "in-progress"),
  );
  return live ? "No se puede archivar un curso con ediciones publicadas próximas o en curso" : null;
}

/** Courses with enrollments are archived, never deleted (their history is kept). */
export function deleteCourseError({ enrollmentCount }) {
  return enrollmentCount > 0
    ? "No se puede eliminar un curso que tiene inscriptos. Archivalo en su lugar."
    : null;
}

/** Only draft editions can be deleted. */
export function deleteEditionError({ status }) {
  return status === "published"
    ? "No se puede eliminar una edición publicada. Despublicala primero."
    : null;
}

/** Price and capacity are fixed once the edition is published. */
export function editionEditError({ status }) {
  return status === "published"
    ? "No se pueden editar el precio ni el cupo de una edición publicada"
    : null;
}

/** Only paid enrollees of a finished edition can review it (403). */
export function reviewEligibilityError({ paid, timeStatus }) {
  if (!paid) return "Solo inscriptos con pago confirmado pueden dejar una reseña";
  if (timeStatus !== "completed") {
    return "Solo podés dejar una reseña una vez que la edición haya finalizado";
  }
  return null;
}

/**
 * Copy of a class for a new edition: no dates, participants, Calendar events,
 * recordings or materials; it belongs to `editionId`.
 */
export function copyClassForEdition(cls, { editionId, adminId, now = new Date() }) {
  const {
    _id: _classId,
    participants: _participants,
    status: _status,
    courseId: _courseId,
    editionId: _editionId,
    start_date: _startDate,
    googleEventId: _googleEventId,
    googleEventUrl: _googleEventUrl,
    googleMeetLink: _googleMeetLink,
    calendarEventLink: _calendarEventLink,
    recording_url: _recordingUrl,
    resources: _resources,
    createdBy: _createdBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = cls;
  return {
    ...rest,
    editionId,
    status: "enrolled",
    max_participants: null,
    start_date: null,
    createdBy: adminId,
    createdAt: now,
    updatedAt: now,
  };
}
