import Swal from "sweetalert2";

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
    allowEscapeKey: false,
    allowOutsideClick: false,
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

export const closeLoading = () => {
  Swal.close();
};
