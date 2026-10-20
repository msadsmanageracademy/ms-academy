import Pagination from "@/views/components/ui/Pagination";
import ReviewList, { ReviewSummary } from "@/views/components/ui/ReviewList";
import styles from "../styles.module.css";
import { useId } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Query string for a page of reviews; page 1 and "every edition" are left out. */
export function reviewsQuery({ page, edition }) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (edition) params.set("edition", edition);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * One server-side page of reviews (`reviews` = { items, page, totalPages, total } from
 * listCourseReviews). The page and the edition filter live in the URL (?page=&edition=),
 * so moving re-renders the Server Component; changing the filter goes back to page 1.
 * Without `editions` there is no filter (e.g. the reviews of a single edition).
 */
const CourseReviewsSection = ({
  reviews,
  editions,
  selectedEditionId = null,
  avgRating,
  reviewCount,
  emptyText = "Todavía no hay reseñas.",
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const filterId = useId();
  const titleId = useId();

  const go = (query) => router.push(`${pathname}${reviewsQuery(query)}`, { scroll: false });

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <div className={`${styles.sectionHeader} ${styles.reviewsHeader}`}>
        <h2 id={titleId}>
          Reseñas
          <ReviewSummary avgRating={avgRating} reviewCount={reviewCount} />
        </h2>
        {editions?.length > 1 && (
          <div className={styles.reviewFilter}>
            <label htmlFor={filterId}>Edición</label>
            <select
              className={styles.select}
              id={filterId}
              value={selectedEditionId ?? ""}
              onChange={(event) => go({ page: 1, edition: event.target.value })}
            >
              <option value="">Todas las ediciones</option>
              {editions.map((edition) => (
                <option key={edition._id} value={edition._id}>
                  {edition.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <ReviewList emptyText={emptyText} reviews={reviews.items} showEdition={Boolean(editions) && !selectedEditionId} />
      <Pagination
        currentPage={reviews.page}
        label="Paginación de reseñas"
        totalPages={reviews.totalPages}
        onPageChange={(page) => go({ page, edition: selectedEditionId })}
      />
    </section>
  );
};

export default CourseReviewsSection;
