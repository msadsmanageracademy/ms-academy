import StarRating from "@/views/components/ui/StarRating";
import styles from "./styles.module.css";

/**
 * Real reviews left by students (see listFeaturedReviews). Without reviews the
 * section isn't shown: no placeholder testimonials.
 */
export default function Testimonials({ reviews }) {
  if (!reviews?.length) return null;

  return (
    <section aria-labelledby="testimonials-title" className={styles.testimonials}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Testimonios</span>
        <h2 className={styles.title} id="testimonials-title">
          Lo que dicen mis alumnos
        </h2>
        <div className={styles.grid}>
          {reviews.map((review) => (
            <figure key={review._id.toString()} className={styles.card}>
              <div className={styles.stars}>
                <StarRating readOnly size="sm" value={review.rating} />
              </div>
              <blockquote className={styles.quote}>&ldquo;{review.comment}&rdquo;</blockquote>
              <figcaption className={styles.author}>
                <span className={styles.name}>{review.firstName}</span>
                {review.aboutTitle && <span className={styles.role}>{review.aboutTitle}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
