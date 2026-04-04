"use client";

import StarRating from "@/views/components/ui/StarRating";
import styles from "./styles.module.css";
import { useState } from "react";
import {
  closeLoading,
  toastError,
  toastLoading,
  toastSuccess,
} from "@/utils/alerts";

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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>
          {existingReview ? "Editar reseña" : "Dejar una reseña"}
        </h3>
        <p className={styles.subtitle}>{entityTitle}</p>

        <div className={styles.field}>
          <label className={styles.label}>Puntuación</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Comentario (opcional)</label>
          <textarea
            className={styles.textarea}
            maxLength={500}
            placeholder="Contá tu experiencia..."
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <span className={styles.charCount}>{comment.length}/500</span>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className={styles.submitBtn}
            disabled={saving || rating === 0}
            onClick={handleSubmit}
          >
            {saving
              ? "Guardando..."
              : existingReview
                ? "Actualizar"
                : "Enviar reseña"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
