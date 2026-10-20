import Swal from "sweetalert2";

const confirmMixin = Swal.mixin({
  background: "var(--color-7)",
  cancelButtonColor: "#4b5563",
  cancelButtonText: "Cancelar",
  customClass: { popup: "confirm-popup" },
  imageAlt: "MS Academy",
  imageUrl: "/images/logo-2.png",
  imageWidth: 80,
  reverseButtons: true,
  showCancelButton: true,
});

export const toastError = (timer, title, text) => {
  Swal.fire({
    background: `var(--color-7)`,
    color: `#fff`,
    customClass: {
      timerProgressBar: "toast-progress-error",
      popup: "toast-popup",
    },
    icon: "error",
    iconColor: "var(--danger)",
    position: "bottom-end",
    showConfirmButton: false,
    text,
    timer,
    timerProgressBar: true,
    title,
    toast: true,
    didOpen: (toast) => {
      toast.addEventListener("mouseenter", Swal.stopTimer);
      toast.addEventListener("mouseleave", Swal.resumeTimer);
    },
  });
};

export const toastLoading = (title, text) => {
  Swal.fire({
    background: `var(--color-7)`,
    color: `#fff`,
    customClass: {
      loader: "custom-loader-toast",
      popup: "toast-popup",
    },
    position: "bottom-end",
    showConfirmButton: false,
    text,
    timer: false,
    title,
    toast: true,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

export const toastSuccess = (timer, title, text) => {
  Swal.fire({
    background: `var(--color-7)`,
    color: `#fff`,
    customClass: {
      timerProgressBar: "toast-progress-success",
      popup: "toast-popup",
    },
    icon: "success",
    iconColor: "var(--success)",
    position: "bottom-end",
    showConfirmButton: false,
    text,
    timer,
    timerProgressBar: true,
    title,
    toast: true,
    didOpen: (toast) => {
      toast.addEventListener("mouseenter", Swal.stopTimer);
      toast.addEventListener("mouseleave", Swal.resumeTimer);
    },
  });
};

export const closeLoading = () => {
  Swal.close();
};

export const confirmDelete = (title, text) => {
  return confirmMixin.fire({
    title,
    text,
    confirmButtonColor: "var(--danger)",
    confirmButtonText: "Eliminar",
  });
};

export const confirmSignUp = (title, text) => {
  return confirmMixin.fire({
    title,
    text,
    confirmButtonColor: "var(--success)",
    confirmButtonText: "Inscribirme",
  });
};

export const confirmUnenroll = (title, text) => {
  return confirmMixin.fire({
    title,
    text,
    confirmButtonColor: "var(--danger)",
    confirmButtonText: "Cancelar inscripción",
    cancelButtonText: "Volver",
  });
};

export const confirmToggleStatus = (newStatus, type) => {
  const toPublish = newStatus === "published";
  return confirmMixin.fire({
    title: toPublish ? `¿Publicar ${type}?` : `¿Archivar ${type}?`,
    text: toPublish
      ? `Se publicará para los usuarios en el cartel de anuncios`
      : `Se ocultará al público y se eliminarán las inscripciones`,
    confirmButtonColor: toPublish ? "var(--success)" : "var(--danger)",
    confirmButtonText: toPublish ? "Publicar" : "Archivar",
  });
};

// Archive or reactivate a course (the product); its editions and history are kept
export const confirmCourseStatus = (newStatus, courseTitle) => {
  const toArchive = newStatus === "archived";
  return confirmMixin.fire({
    title: toArchive ? "¿Archivar curso?" : "¿Reactivar curso?",
    text: toArchive
      ? `"${courseTitle}" dejará de mostrarse en el catálogo. Sus ediciones, alumnos y reseñas se conservan.`
      : `"${courseTitle}" vuelve a estar activo y vas a poder publicar sus ediciones.`,
    confirmButtonColor: toArchive ? "var(--danger)" : "var(--success)",
    confirmButtonText: toArchive ? "Archivar" : "Reactivar",
  });
};

// Publish an edition (opens enrollment) or take it back to draft (enrollments are kept)
export const confirmEditionStatus = (newStatus, editionTitle) => {
  const toPublish = newStatus === "published";
  return confirmMixin.fire({
    title: toPublish ? "¿Publicar edición?" : "¿Despublicar edición?",
    text: toPublish
      ? `"${editionTitle}" se mostrará en el catálogo y los alumnos van a poder inscribirse.`
      : `"${editionTitle}" vuelve a borrador y deja de mostrarse en el catálogo. Sus inscriptos se conservan.`,
    confirmButtonColor: toPublish ? "var(--success)" : "var(--danger)",
    confirmButtonText: toPublish ? "Publicar" : "Despublicar",
  });
};

// Deleting an edition also deletes its classes, enrollments and reviews
export const confirmDeleteEdition = (editionTitle, enrollmentCount) => {
  const notice =
    enrollmentCount > 0
      ? ` ${enrollmentCount === 1 ? "Su inscripto va a recibir" : `Sus ${enrollmentCount} inscriptos van a recibir`} un aviso.`
      : "";
  return confirmMixin.fire({
    title: "¿Eliminar edición?",
    text: `Se eliminará "${editionTitle}" con sus clases, inscripciones y reseñas de forma permanente.${notice}`,
    confirmButtonColor: "var(--danger)",
    confirmButtonText: "Eliminar",
  });
};

export const confirmReauth = (message) => {
  return confirmMixin.fire({
    title: "Autorización expirada",
    text: message,
    confirmButtonColor: "var(--success)",
    confirmButtonText: "Volver a autorizar",
  });
};

export const confirmNotify = (title, text) => {
  return confirmMixin.fire({
    title,
    text,
    confirmButtonColor: "var(--success)",
    confirmButtonText: "Enviar",
  });
};

export const confirmAddToCalendar = (title) => {
  return confirmMixin.fire({
    title: "¿Agregar a Google Calendar?",
    text: `Se creará un evento para "${title}" en tu Google Calendar`,
    confirmButtonColor: "var(--success)",
    confirmButtonText: "Agregar",
  });
};

// `editionTitle` = "Curso · Septiembre 2026" (editionName)
export const confirmUnlink = (classTitle, editionTitle) => {
  return confirmMixin.fire({
    title: "¿Desvincular clase?",
    text: `"${classTitle}" será desvinculada de "${editionTitle}" y quedará como borrador suelto`,
    confirmButtonColor: "var(--danger)",
    confirmButtonText: "Desvincular",
  });
};

export const confirmDeleteItem = (type, title) => {
  return confirmMixin.fire({
    title: `¿Eliminar ${type}?`,
    text: `Se eliminará "${title}" de forma permanente`,
    confirmButtonColor: "var(--danger)",
    confirmButtonText: "Eliminar",
  });
};

export const confirmPayment = (courseTitle, participantName) => {
  return confirmMixin.fire({
    title: "Confirmar pago",
    text: participantName
      ? `¿Confirmar el pago de ${participantName} para el curso "${courseTitle}"?`
      : `¿Confirmar el pago para el curso "${courseTitle}"?`,
    confirmButtonColor: "var(--success)",
    confirmButtonText: "Confirmar pago",
  });
};
