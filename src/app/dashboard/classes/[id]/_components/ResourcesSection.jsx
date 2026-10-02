import styles from "../styles.module.css";
import { runApiAction } from "@/utils/api";
import { saveClassResourcesAction } from "@/server/actions/classes";
import { toastError } from "@/utils/alerts";
import { useState } from "react";

/** Materials of a course class: edited locally, saved together. */
const ResourcesSection = ({ classId, initialResources }) => {
  const [resources, setResources] = useState(initialResources);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    if (!title.trim() || !url.trim()) return;
    try {
      new URL(url);
    } catch {
      return toastError(2000, "URL inválida", "Ingresá una URL válida");
    }
    setResources((prev) => [...prev, { title: title.trim(), url: url.trim() }]);
    setTitle("");
    setUrl("");
  };

  const handleSave = async () => {
    setSaving(true);
    await runApiAction({
      loading: ["Guardando materiales", "Actualizando lista..."],
      request: () => saveClassResourcesAction(classId, resources),
      success: ["Materiales actualizados", "La lista fue guardada correctamente"],
      failure: "No se pudieron guardar los materiales",
    });
    setSaving(false);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Materiales</h2>
      </div>
      <div className={styles.resourceAddRow}>
        <input
          aria-label="Título del material"
          className={styles.recordingInput}
          placeholder="Título del material"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          aria-label="URL del material"
          className={styles.recordingInput}
          placeholder="https://..."
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className={styles.recordingBtn} onClick={handleAdd}>
          Agregar
        </button>
      </div>
      {resources.length > 0 && (
        <>
          <ul className={styles.resourceList}>
            {resources.map((resource, i) => (
              <li key={i} className={styles.resourceItem}>
                <a href={resource.url} rel="noopener noreferrer" target="_blank">
                  {resource.title}
                </a>
                <button
                  aria-label={`Quitar ${resource.title}`}
                  className={styles.resourceRemoveBtn}
                  onClick={() => setResources((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className={styles.recordingBtn} disabled={saving} onClick={handleSave}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      )}
    </section>
  );
};

export default ResourcesSection;
