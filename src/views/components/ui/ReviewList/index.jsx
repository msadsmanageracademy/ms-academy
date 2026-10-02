import StarRating from "@/views/components/ui/StarRating";
import { formatDate } from "@/utils/dates";
import styles from "./styles.module.css";

export const ReviewSummary = ({ avgRating, reviewCount, className = styles.summary }) => {
  if (!reviewCount) return null;
  return (
    <span className={className}>
      <StarRating value={Math.round(avgRating)} readOnly size="sm" />
      {Number(avgRating).toFixed(1)} ({reviewCount})
    </span>
  );
};

export const averageRating = (reviews) =>
  reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

const ReviewList = ({ reviews, emptyText }) => {
  if (reviews.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <ul className={styles.list}>
      {reviews.map((review) => (
        <li key={review._id?.toString()} className={styles.item}>
          <div className={styles.header}>
            <span className={styles.author}>{review.firstName}</span>
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
