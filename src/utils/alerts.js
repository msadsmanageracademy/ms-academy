import Swal from "sweetalert2";

export const toastError = (timer, title, text) => {
  Swal.fire({
    background: `rgba(28, 25, 25, 0.95)`,
    color: `#fff`,
    customClass: { timerProgressBar: "toast-progress-dark" },
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

export const toastSuccess = (timer, title, text) => {
  Swal.fire({
    background: `rgba(28, 25, 25, 0.95)`,
    color: `#fff`,
    customClass: { timerProgressBar: "toast-progress-dark" },
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

export const confirmDelete = (title, text) => {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "var(--danger)",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  });
};

export const confirmSignUp = (title, text) => {
  return Swal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "var(--success)",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Sí, inscribirme",
    cancelButtonText: "Cancelar",
  });
};

export const confirmUnenroll = (title, text) => {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "var(--danger)",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Sí, cancelar inscripción",
    cancelButtonText: "No, mantener inscripción",
  });
};

export const showLoading = (title, text) => {
  Swal.fire({
    title,
    text,
    showConfirmButton: false,
    allowEscapeKey: false,
    allowOutsideClick: false,
    customClass: {
      loader: "custom-loader",
    },
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

export const closeLoading = () => {
  Swal.close();
};
