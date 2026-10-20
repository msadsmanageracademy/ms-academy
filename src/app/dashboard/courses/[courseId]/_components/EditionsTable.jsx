import ClassStatusBadge from "@/views/components/ui/ClassStatusBadge";
import IconLink from "@/views/components/ui/IconLink";
import Link from "next/link";
import Pagination from "@/views/components/ui/Pagination";
import StatusBadge from "@/views/components/ui/StatusBadge";
import { ReviewSummary } from "@/views/components/ui/ReviewList";
import { adminEditionNumber } from "@/utils/courseEditions";
import { formatDate } from "@/utils/dates";
import { formatPrice } from "@/utils/price";
import styles from "../styles.module.css";
import { useMemo } from "react";
import { useTableControls } from "@/hooks/useTableControls";

export const EDITIONS_PAGE_SIZE = 10;

const searchFields = (edition) => [edition.label];

const editionHref = (courseId, editionId) => `/dashboard/courses/${courseId}/editions/${editionId}`;

const EditionDates = ({ edition }) =>
  edition.start_date ? (
    <div className={styles.cellStack}>
      <span>
        {formatDate(edition.start_date)} – {formatDate(edition.end_date)}
      </span>
      <ClassStatusBadge gender="f" status={edition.timeStatus} />
    </div>
  ) : (
    <span className={styles.muted}>Sin fechas</span>
  );

const Enrollments = ({ edition }) => (
  <div className={styles.cellStack}>
    <span>
      {edition.enrollmentCount ?? 0} / {edition.max_participants || "∞"}
    </span>
    <span className={styles.muted}>
      {edition.paidCount ?? 0} {edition.paidCount === 1 ? "pago" : "pagos"}
    </span>
  </div>
);

/**
 * Every edition of the course (chronologically last first, so undated drafts lead),
 * paginated, with its admin number ("Edición N de M"). Each row links to the edition
 * detail by id; drafts can also be opened straight into their edit form (?edit=1).
 */
const EditionsTable = ({ courseId, editions, onNewEdition }) => {
  const sorted = useMemo(() => [...editions].sort((a, b) => b.adminNumber - a.adminNumber), [editions]);
  const table = useTableControls(sorted, { fields: searchFields, pageSize: EDITIONS_PAGE_SIZE });

  return (
    <section aria-labelledby="course-editions-title" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="course-editions-title">Ediciones</h2>
        <IconLink
          aria-label="Crear una nueva edición de este curso"
          asButton
          icon="Plus"
          onClick={onNewEdition}
          success
          text="Nueva edición"
          title="Crear una nueva edición de este curso"
        />
      </div>
      {editions.length === 0 ? (
        <p className={styles.noParticipants}>Este curso todavía no tiene ediciones.</p>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={`${styles.table} ${styles.editionsTable}`}>
              <caption className="visually-hidden">Ediciones del curso</caption>
              <thead>
                <tr>
                  <th scope="col">Edición</th>
                  <th scope="col">Fechas</th>
                  <th scope="col">Clases</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Inscriptos</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Reseñas</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {table.pageItems.map((edition) => {
                  const href = editionHref(courseId, edition._id);
                  const published = edition.status === "published";
                  return (
                    <tr key={edition._id}>
                      <th className={styles.editionName} scope="row">
                        <div className={styles.cellStack}>
                          <Link href={href}>{edition.label}</Link>
                          <span className={styles.muted}>
                            {adminEditionNumber(edition.adminNumber, editions.length)}
                          </span>
                        </div>
                      </th>
                      <td>
                        <EditionDates edition={edition} />
                      </td>
                      <td>{edition.amount_of_classes ?? 0}</td>
                      <td>{formatPrice(edition.price)}</td>
                      <td>
                        <Enrollments edition={edition} />
                      </td>
                      <td>
                        <StatusBadge status={edition.status}>{published ? "Publicada" : "Borrador"}</StatusBadge>
                      </td>
                      <td>
                        {edition.reviewCount ? (
                          <ReviewSummary
                            avgRating={edition.avgRating}
                            className={styles.ratingSummary}
                            reviewCount={edition.reviewCount}
                          />
                        ) : (
                          <span className={styles.muted}>Sin reseñas</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <IconLink
                            aria-label={`Ver ${edition.label}`}
                            fill="var(--color-4)"
                            href={href}
                            icon="Eye"
                            title="Ver detalles"
                          />
                          {!published && (
                            <IconLink
                              aria-label={`Editar ${edition.label}`}
                              href={`${href}?edit=1`}
                              icon="Pencil"
                              title="Editar precio y cupo"
                              warning
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={table.page}
            label="Paginación de ediciones"
            totalPages={table.totalPages}
            onPageChange={table.setPage}
          />
        </>
      )}
    </section>
  );
};

export default EditionsTable;
