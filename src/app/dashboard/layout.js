"use client";

import Sidebar from "./Sidebar";
import styles from "./styles.module.css";

export default function ProfileLayout({ children }) {
  return (
    <div className={styles.layoutContainer}>
      <Sidebar />
      <div className={styles.mainContent}>{children}</div>
    </div>
  );
}
