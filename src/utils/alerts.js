import Swal from "sweetalert2";

// Función para mostrar el error como una toast notification
export const toastError = (timer, title, text) => {
  Swal.fire({
    background: `rgba(28, 25, 25, 0.95)`,
    color: `#fff`,
    customClass: { timerProgressBar: "toast-progress-dark" },
    icon: "error",
    iconColor: "#b30a0a",
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
    iconColor: "#4bb543",
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

export const toastInformation = (timer, title, text) => {
  Swal.fire({
    background: `rgba(28, 25, 25, 0.95)`,
    color: `#fff`,
    customClass: { timerProgressBar: "toast-progress-dark" },
    icon: "info",
    iconColor: "#2e9abd",
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
