import styles from "../styles.module.css";
import { runApiAction } from "@/utils/api";
import { saveClassRecordingAction } from "@/server/actions/classes";
import { useState } from "react";

/** Recording link of a course class. Saving an empty URL removes it. */
const RecordingSection = ({ classId, currentUrl }) => {
  const [url, setUrl] = useState(currentUrl || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await runApiAction({
      loading: ["Guardando grabación", "Actualizando URL..."],
      request: () => saveClassRecordingAction(classId, url),
      success: ["Grabación actualizada", "La URL fue guardada correctamente"],
      failure: "No se pudo guardar la URL de grabación",
    });
    setSaving(false);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Grabación</h2>
      </div>
      <div className={styles.recordingRow}>
        <input
          aria-label="URL de la grabación"
          className={styles.recordingInput}
          placeholder="https://..."
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className={styles.recordingBtn} disabled={saving} onClick={handleSave}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
      {currentUrl && (
        <p className={styles.recordingCurrent}>
          URL actual:{" "}
          <a href={currentUrl} rel="noopener noreferrer" target="_blank">
            {currentUrl}
          </a>
        </p>
      )}
    </section>
  );
};

export default RecordingSection;
