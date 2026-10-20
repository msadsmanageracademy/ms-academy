import StarRating from "@/views/components/ui/StarRating";
import { formatDate } from "@/utils/dates";
import styles from "./styles.module.css";

export const formatRating = (avg) =>
  Number(avg).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const ReviewSummary = ({ avgRating, reviewCount, className = styles.summary }) => {
  if (!reviewCount) return null;
  return (
    <span className={className}>
      <StarRating value={avgRating} readOnly size="sm" />
      {formatRating(avgRating)} ({reviewCount})
    </span>
  );
};

export const averageRating = (reviews) =>
  reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

const ReviewList = ({ reviews, emptyText, showEdition = false }) => {
  if (reviews.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <ul className={styles.list}>
      {reviews.map((review) => (
        <li key={review._id?.toString()} className={styles.item}>
          <div className={styles.header}>
            <span className={styles.author}>{review.firstName}</span>
            {showEdition && review.editionLabel && (
              <span className={styles.edition}>{review.editionLabel}</span>
            )}
            <StarRating value={review.rating} readOnly size="sm" />
            <span className={styles.date}>{formatDate(review.createdAt)}</span>
          </div>
          {review.comment && <p className={styles.comment}>{review.comment}</p>}
        </li>
      ))}
    </ul>
  );
};

export default ReviewList;
