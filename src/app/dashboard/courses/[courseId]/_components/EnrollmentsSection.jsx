import CapacityBar from "@/views/components/ui/CapacityBar";
import IconLink from "@/views/components/ui/IconLink";
import Pagination from "@/views/components/ui/Pagination";
import TableSearch from "@/views/components/ui/TableSearch";
import StatusBadge from "@/views/components/ui/StatusBadge";
import { runApiAction } from "@/utils/api";
import styles from "../styles.module.css";
import { useTableControls } from "@/hooks/useTableControls";
import { confirmEditionPaymentAction, removeEditionEnrollmentAction } from "@/server/actions/courses";
import { confirmPayment, confirmUnenroll } from "@/utils/alerts";

const searchFields = (e) => [e.first_name, e.last_name, e.email, e.paymentStatus === "paid" ? "pagado" : "pendiente"];

const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(" ") || e.email;

/**
 * Enrollees of an edition: confirm payments (manual until a gateway exists) or remove
 * pending ones. `title` names the edition in the dialogs ("Curso · Septiembre 2026").
 */
const EnrollmentsSection = ({ edition, title, enrollments }) => {
  const max = edition.max_participants;
  const table = useTableControls(enrollments, { fields: searchFields });

  const handleConfirmPayment = async (enrollment) => {
    const name = fullName(enrollment);
    if (!(await confirmPayment(title, name)).isConfirmed) return;
    await runApiAction({
      loading: ["Procesando solicitud", "Confirmando pago..."],
      request: () => confirmEditionPaymentAction(edition._id, enrollment._id),
      success: ["Pago confirmado", `${name} ya está inscripto`],
      failure: "No se pudo confirmar el pago",
    });
  };

  const handleRemove = async (enrollment) => {
    const confirmed = await confirmUnenroll(
      "¿Remover participante?",
      "El usuario será dado de baja de esta edición",
    );
    if (!confirmed.isConfirmed) return;
    await runApiAction({
      loading: ["Procesando solicitud", "Removiendo participante..."],
      request: () => removeEditionEnrollmentAction(edition._id, enrollment._id),
      success: ["Operación exitosa", "Participante removido correctamente"],
      failure: "No se pudo remover el participante",
    });
  };

  return (
    <section aria-labelledby="edition-enrollments-title" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="edition-enrollments-title">
          Participantes ({enrollments.length}
          {max > 0 && ` / ${max}`})
        </h2>
      </div>
      <CapacityBar current={enrollments.length} max={max} />
      {enrollments.length > 0 && (
        <TableSearch
          className={styles.tableSearch}
          filteredCount={table.filteredCount}
          label="Buscar inscriptos"
          placeholder="Nombre, email, pagado o pendiente..."
          totalCount={table.totalCount}
          value={table.query}
          onChange={table.setQuery}
        />
      )}
      {enrollments.length === 0 ? (
        <p className={styles.noParticipants}>No hay participantes inscriptos</p>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <caption className="visually-hidden">Participantes de la edición</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Apellido</th>
                <th scope="col">Email</th>
                <th scope="col">Pago</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {table.pageItems.length === 0 && (
                <tr>
                  <td colSpan={5}>Ningún inscripto coincide con la búsqueda</td>
                </tr>
              )}
              {table.pageItems.map((enrollment) => {
                const paid = enrollment.paymentStatus === "paid";
                const name = fullName(enrollment);
                return (
                  <tr key={enrollment._id}>
                    <td>{enrollment.first_name}</td>
                    <td>{enrollment.last_name || "-"}</td>
                    <td>{enrollment.email}</td>
                    <td>
                      <StatusBadge status={paid ? "published" : "pending"}>
                        {paid ? "Pagado" : "Pendiente"}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <IconLink
                          aria-label={paid ? `Pago de ${name} confirmado` : `Confirmar pago de ${name}`}
                          asButton
                          disabled={paid}
                          icon="Money"
                          onClick={() => handleConfirmPayment(enrollment)}
                          success
                          title={paid ? "Pago confirmado" : "Confirmar pago"}
                        />
                        <IconLink
                          aria-label={`Remover a ${name}`}
                          asButton
                          danger
                          disabled={paid}
                          icon="UserMinus"
                          onClick={() => handleRemove(enrollment)}
                          title={
                            paid
                              ? "No se puede remover un participante que ya pagó"
                              : "Remover participante"
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={table.page}
            label="Paginación de participantes"
            totalPages={table.totalPages}
            onPageChange={table.setPage}
          />
        </div>
      )}
    </section>
  );
};

export default EnrollmentsSection;
