// Catalog of every notification the app sends.
// Each key is a template: it defines the stored `type` (what the UI uses to pick an
// icon) and builds the user-facing Spanish title/message from `vars`.
// Several templates can share a type (e.g. different reasons for the same event).

/** "Ana Pérez", or the fallback when the user has no name */
export function displayName(user, fallback = "Un usuario") {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export const NOTIFICATION_TEMPLATES = {
  // ---------- Classes: students ----------
  "class.enrolled": {
    type: "class.enrolled",
    title: "Inscripción exitosa",
    message: ({ classTitle }) => `Te has inscrito en la clase "${classTitle}"`,
  },
  "class.unenrolled": {
    type: "class.unenrolled",
    title: "Inscripción cancelada",
    message: ({ classTitle }) => `Has cancelado tu inscripción en la clase "${classTitle}"`,
  },
  "class.removed_by_admin": {
    type: "class.removed_by_admin",
    title: "Suscripción anulada",
    message: ({ classTitle }) =>
      `Has sido dado de baja de la clase "${classTitle}" por un administrador`,
  },
  "class.removed_by_admin.archived": {
    type: "class.removed_by_admin",
    title: "Suscripción anulada",
    message: ({ classTitle }) =>
      `Has sido dado de baja de la clase "${classTitle}" porque fue archivada por un administrador`,
  },
  "class.removed_by_admin.course_deleted": {
    type: "class.removed_by_admin",
    title: "Suscripción anulada",
    message: ({ classTitle }) =>
      `Has sido dado de baja de la clase "${classTitle}" porque el curso al que pertenecía fue eliminado`,
  },
  "class.updated": {
    type: "class.updated",
    title: "Clase actualizada",
    message: ({ classTitle }) => `La clase "${classTitle}" ha sido actualizada`,
  },
  "class.cancelled": {
    type: "class.cancelled",
    title: "Clase cancelada",
    message: ({ classTitle }) => `La clase "${classTitle}" ha sido cancelada`,
  },
  "class.reminder": {
    type: "class.reminder",
    title: "Recordatorio de clase",
    message: ({ classTitle, date }) => `Tu clase "${classTitle}" es el ${date}`,
  },
  "class.recording_added": {
    type: "class.recording_added",
    title: "Grabación disponible",
    message: ({ classTitle }) => `La grabación de la clase "${classTitle}" ya está disponible`,
  },
  "class.resources_updated": {
    type: "class.resources_updated",
    title: "Materiales actualizados",
    message: ({ classTitle }) => `Los materiales de la clase "${classTitle}" han sido actualizados`,
  },
  "class.added_to_course": {
    type: "class.added_to_course",
    title: "Nueva clase en tu curso",
    message: ({ classTitle, courseTitle }) =>
      `Se agregó la clase "${classTitle}" al curso "${courseTitle}"`,
  },
  "class.removed_from_course": {
    type: "class.removed_from_course",
    title: "Clase removida de tu curso",
    message: ({ classTitle, courseTitle }) =>
      `La clase "${classTitle}" fue eliminada del curso "${courseTitle}"`,
  },

  // ---------- Classes: admin ----------
  "class.created": {
    type: "class.created",
    title: "Nueva clase creada",
    message: ({ classTitle }) => `Has creado la clase "${classTitle}"`,
  },
  "class.deleted": {
    type: "class.cancelled",
    title: "Clase eliminada",
    message: ({ classTitle }) => `Has eliminado la clase "${classTitle}"`,
  },
  "class.participant_joined": {
    type: "class.participant_joined",
    title: "Nuevo participante",
    message: ({ user, classTitle }) => `${displayName(user)} se ha inscrito en "${classTitle}"`,
  },
  "class.participant_left": {
    type: "class.participant_left",
    title: "Cancelación de inscripción",
    message: ({ user, classTitle }) =>
      `${displayName(user)} ha cancelado su inscripción en "${classTitle}"`,
  },
  "class.participant_removed": {
    type: "class.participant_removed",
    title: "Participante removido",
    message: ({ user, classTitle }) =>
      `Has removido a ${displayName(user, "un usuario")} de la clase "${classTitle}"`,
  },
  "class.added_to_calendar": {
    type: "class.added_to_calendar",
    title: "Clase agregada a Calendar",
    message: ({ classTitle }) => `La clase "${classTitle}" se agregó a Google Calendar`,
  },
  "class.status_changed": {
    type: "class.status_changed",
    title: "Estado de clase actualizado",
    message: ({ classTitle, published }) =>
      `La clase "${classTitle}" fue ${published ? "publicada" : "archivada"}`,
  },
  "class.linked_to_course": {
    type: "class.status_changed",
    title: "Clase asignada a curso",
    message: ({ classTitle, courseTitle }) =>
      `La clase "${classTitle}" fue asignada al curso "${courseTitle}"`,
  },
  "class.unlinked_from_course": {
    type: "class.status_changed",
    title: "Clase removida de curso",
    message: ({ classTitle, courseTitle }) =>
      `La clase "${classTitle}" fue eliminada del curso "${courseTitle}"`,
  },

  // ---------- Courses: students ----------
  "course.pre_enrolled": {
    type: "course.pre_enrolled",
    title: "Pre-inscripción realizada",
    message: ({ courseTitle }) =>
      `Te pre-inscribiste en el curso "${courseTitle}". Completá el pago para confirmar tu inscripción.`,
  },
  "course.unenrolled": {
    type: "course.unenrolled",
    title: "Inscripción cancelada",
    message: ({ courseTitle }) => `Cancelaste tu inscripción al curso "${courseTitle}".`,
  },
  "course.payment_confirmed": {
    type: "course.payment_confirmed",
    title: "Pago confirmado",
    message: ({ courseTitle }) =>
      `Tu pago para el curso "${courseTitle}" fue confirmado. ¡Ya estás inscripto!`,
  },
  "course.removed_by_admin": {
    type: "course.removed_by_admin",
    title: "Removido del curso",
    message: ({ courseTitle }) =>
      `Fuiste removido del curso "${courseTitle}" por el administrador.`,
  },

  // ---------- Courses: admin ----------
  "course.participant_pre_joined": {
    type: "course.participant_pre_joined",
    title: "Nueva pre-inscripción",
    message: ({ courseTitle }) =>
      `Un usuario se pre-inscribió en el curso "${courseTitle}" y tiene pago pendiente.`,
  },
  "course.participant_left": {
    type: "course.participant_left",
    title: "Un participante canceló su inscripción",
    message: ({ courseTitle }) => `Un usuario canceló su inscripción al curso "${courseTitle}".`,
  },
  "course.payment_received": {
    type: "course.payment_received",
    title: "Pago recibido",
    message: ({ courseTitle }) =>
      `Se confirmó el pago de un participante para el curso "${courseTitle}".`,
  },

  // ---------- Contact ----------
  "contact.message": {
    type: "contact.message",
    title: "Nuevo mensaje de contacto",
    message: ({ name, email, subject }) => `${name} (${email}) escribió: ${subject}`,
  },
};
