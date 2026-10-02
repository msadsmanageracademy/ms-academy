import CapacityBar from "@/views/components/ui/CapacityBar";
import IconLink from "@/views/components/ui/IconLink";
import Pagination from "@/views/components/ui/Pagination";
import TableSearch from "@/views/components/ui/TableSearch";
import { runApiAction } from "@/utils/api";
import styles from "../styles.module.css";
import { useNotifications } from "@/providers/NotificationProvider";
import { useState } from "react";
import { useTableControls } from "@/hooks/useTableControls";
import { confirmNotify, confirmUnenroll, toastError } from "@/utils/alerts";
import { downloadCsv, safeFilename, toCsv } from "@/utils/csv";
import { removeClassParticipantAction, sendClassRemindersAction } from "@/server/actions/classes";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const searchFields = (p) => [p.first_name, p.last_name, p.email];

/** Shows a temporary "done" state on a button for `ms` milliseconds. */
function useFlash(ms) {
  const [active, setActive] = useState(false);
  const flash = () => {
    setActive(true);
    setTimeout(() => setActive(false), ms);
  };
  return [active, flash];
}

/** Participants of a standalone class, with reminders, export and removal. */
const ParticipantsSection = ({ classData, participants }) => {
  const { incrementCount } = useNotifications();
  const [notifying, setNotifying] = useState(null); // participant being reminded
  const [meetCopied, flashMeetCopied] = useFlash(1500);
  const [exported, flashExported] = useFlash(3000);
  const [notifiedAll, flashNotifiedAll] = useFlash(30000);
  const classId = classData._id;
  const max = classData.max_participants;
  const table = useTableControls(participants, { fields: searchFields });

  const handleRemove = async (participant) => {
    const confirmed = await confirmUnenroll(
      "¿Remover participante?",
      "El usuario será dado de baja de esta clase",
    );
    if (!confirmed.isConfirmed) return;
    const res = await runApiAction({
      loading: ["Procesando solicitud", "Removiendo participante..."],
      request: () => removeClassParticipantAction(classId, participant._id),
      success: ["Operación exitosa", "Participante removido correctamente"],
      failure: "No se pudo remover el participante",
    });
    if (res) incrementCount(); // the server notifies the admin
  };

  const sendReminder = (participantIds) => sendClassRemindersAction(classId, participantIds);

  const handleRemindOne = async (participant) => {
    const confirmed = await confirmNotify(
      "¿Notificar al participante?",
      "Se enviará un email recordatorio de la clase al participante seleccionado",
    );
    if (!confirmed.isConfirmed) return;
    setNotifying(participant._id);
    await runApiAction({
      loading: ["Enviando recordatorio", "Enviando email..."],
      request: () => sendReminder([participant._id]),
      success: ["Email enviado", "Se notificó al participante"],
      failure: "No se pudo enviar el email",
    });
    setTimeout(() => setNotifying(null), 2000);
  };

  const handleRemindAll = async () => {
    const confirmed = await confirmNotify(
      "¿Notificar a todos?",
      `Se enviará un email recordatorio de la clase a ${plural(participants.length, "participante")}`,
    );
    if (!confirmed.isConfirmed) return;
    const res = await runApiAction({
      loading: ["Enviando recordatorios", "Enviando emails..."],
      request: () => sendReminder(),
      success: (r) => ["Emails enviados", `Se notificó a ${plural(r.data.notifiedCount, "participante")}`],
      failure: "No se pudieron enviar los emails",
    });
    if (res) flashNotifiedAll();
  };

  const handleCopyMeetLink = () => {
    navigator.clipboard.writeText(classData.googleMeetLink);
    flashMeetCopied();
  };

  const handleExport = () => {
    if (participants.length === 0) {
      return toastError(2000, "Sin participantes", "No hay participantes para exportar");
    }
    downloadCsv(
      `${safeFilename(classData.title)}_participantes.csv`,
      toCsv(
        ["Nombre", "Apellido", "Email"],
        participants.map((p) => [p.first_name, p.last_name, p.email]),
      ),
    );
    flashExported();
  };

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            Participantes ({participants.length}
            {max > 0 && ` / ${max}`})
          </h2>
        </div>
        <CapacityBar current={participants.length} max={max} />
        {participants.length > 0 && (
          <TableSearch
            className={styles.tableSearch}
            filteredCount={table.filteredCount}
            label="Buscar participantes"
            placeholder="Buscar por nombre o email..."
            totalCount={table.totalCount}
            value={table.query}
            onChange={table.setQuery}
          />
        )}
        {participants.length === 0 ? (
          <p className={styles.noParticipants}>No hay participantes inscritos</p>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Apellido</th>
                  <th>Email</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {table.pageItems.length === 0 && (
                    <tr>
                      <td colSpan={4}>Ningún participante coincide con la búsqueda</td>
                    </tr>
                  )}
                {table.pageItems.map((participant) => {
                  const isNotifying = notifying === participant._id;
                  return (
                    <tr key={participant._id}>
                      <td>{participant.first_name}</td>
                      <td>{participant.last_name || "-"}</td>
                      <td>{participant.email}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <IconLink
                            asButton
                            disabled={isNotifying}
                            fill={isNotifying ? "var(--success)" : "var(--color-4)"}
                            icon={isNotifying ? "CheckCircle" : "Mailbox"}
                            onClick={() => handleRemindOne(participant)}
                            title="Enviar recordatorio"
                          />
                          <IconLink
                            asButton
                            danger
                            icon="UserMinus"
                            onClick={() => handleRemove(participant)}
                            title="Remover participante"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination currentPage={table.page} totalPages={table.totalPages} onPageChange={table.setPage} />
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Acciones Rápidas</h2>
        </div>
        <div className={styles.quickActions}>
          <IconLink
            asButton
            disabled={meetCopied || !classData.googleMeetLink}
            fill={meetCopied && "var(--success)"}
            icon={meetCopied ? "CheckCircle" : "GoogleMeet"}
            text={meetCopied ? "Copiado" : "Copiar"}
            onClick={handleCopyMeetLink}
          />
          <IconLink
            asButton
            disabled={exported || participants.length === 0}
            fill={exported ? "var(--success)" : "var(--color-4)"}
            icon={exported ? "CheckCircle" : "ListCheck"}
            text={exported ? "Descargado" : "Exportar (CSV)"}
            onClick={handleExport}
          />
          <IconLink
            asButton
            disabled={notifiedAll || participants.length === 0}
            fill={notifiedAll ? "var(--success)" : "var(--color-4)"}
            icon={notifiedAll ? "CheckCircle" : "Mailbox"}
            text={notifiedAll ? "Notificados" : "Notificar participantes"}
            onClick={handleRemindAll}
          />
        </div>
      </section>
    </>
  );
};

export default ParticipantsSection;
