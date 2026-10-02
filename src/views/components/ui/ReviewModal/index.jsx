"use client";

import Modal from "@/views/components/ui/Modal";
import StarRating from "@/views/components/ui/StarRating";
import styles from "./styles.module.css";
import {
  closeLoading,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";
import { useId, useState } from "react";

const MAX_COMMENT = 500;

const ReviewModal = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
  existingReview,
  onSuccess,
}) => {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const ratingLabelId = useId();
  const commentId = useId();
  const counterId = useId();

  if (!isOpen) return null;

  const apiPath =
    entityType === "course"
      ? `/api/courses/${entityId}/reviews`
      : `/api/classes/${entityId}/reviews`;

  const handleSubmit = async () => {
    if (rating === 0) {
      return toastError(
        2000,
        "Sin puntuación",
        "Seleccioná al menos una estrella",
      );
    }
    setSaving(true);
    toastLoading("Guardando reseña", "Enviando...");
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      closeLoading();
      if (!res.ok) return toastError(3000, "Ha habido un error", data.message);
      toastSuccess(
        3000,
        "Reseña guardada",
        existingReview ? "Tu reseña fue actualizada" : "Tu reseña fue enviada",
      );
      onSuccess?.({ rating, comment });
      onClose();
    } catch {
      closeLoading();
      toastError(3000, "Ha habido un error", "No se pudo guardar la reseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      className={styles.modal}
      onClose={onClose}
      overlayClassName={styles.overlay}
      title={existingReview ? "Editar reseña" : "Dejar una reseña"}
      titleClassName={styles.title}
    >
      <p className={styles.subtitle}>{entityTitle}</p>

      <div className={styles.field}>
        <span className={styles.label} id={ratingLabelId}>
          Puntuación
        </span>
        <StarRating value={rating} onChange={setRating} labelledBy={ratingLabelId} />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={commentId}>
          Comentario (opcional)
        </label>
        <textarea
          aria-describedby={counterId}
          className={styles.textarea}
          id={commentId}
          maxLength={MAX_COMMENT}
          placeholder="Contá tu experiencia..."
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <span className={styles.charCount} id={counterId}>
          {comment.length}/{MAX_COMMENT}
          <span className="visually-hidden"> caracteres</span>
        </span>
      </div>

      <div className={styles.actions}>
        <button className={styles.cancelBtn} disabled={saving} onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className={styles.submitBtn}
          disabled={saving || rating === 0}
          onClick={handleSubmit}
          type="button"
        >
          {saving ? "Guardando..." : existingReview ? "Actualizar" : "Enviar reseña"}
        </button>
      </div>
    </Modal>
  );
};

export default ReviewModal;
