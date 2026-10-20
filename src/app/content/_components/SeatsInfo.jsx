import { User } from "@/views/components/icons";
import { getSeatsInfo } from "@/utils/seats";
import styles from "../styles.module.css";

const SeatsInfo = ({ taken, max, showBar = false }) => {
  const seats = getSeatsInfo(taken, max);
  const textClass = [
    styles.seats,
    seats.low ? styles.seatsLow : "",
    seats.full ? styles.seatsFull : "",
  ].join(" ");

  return (
    <div className={styles.seatsWrapper}>
      <p className={textClass}>
        <User fill="currentColor" size={16} /> {seats.label}
      </p>
      {showBar && !seats.unlimited ? (
        <span
          aria-hidden="true"
          className={`${styles.seatsBar} ${seats.full ? styles.seatsBarFull : ""}`}
        >
          <span className={styles.seatsFill} style={{ width: `${seats.percentage}%` }} />
        </span>
      ) : null}
    </div>
  );
};

export default SeatsInfo;
