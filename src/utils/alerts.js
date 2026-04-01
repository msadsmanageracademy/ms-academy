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

export const confirmUnlink = (classTitle, courseTitle) => {
  return confirmMixin.fire({
    title: "¿Desvincular clase?",
    text: `"${classTitle}" será desvinculada del curso "${courseTitle}"`,
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

export const confirmPayment = (courseTitle) => {
  return confirmMixin.fire({
    title: "Confirmar pago",
    text: `¿Confirmar el pago para el curso "${courseTitle}"?`,
    confirmButtonColor: "var(--success)",
    confirmButtonText: "Confirmar pago",
  });
};
