import OvalSpinner from "@/views/components/ui/OvalSpinner";
import styles from "./styles.module.css";

export default function PageLoader() {
  return (
    <div className={styles.container}>
      <OvalSpinner />
    </div>
  );
}
