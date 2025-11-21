"use client";

import PageWrapper from "@/views/components/layout/PageWrapper";
import Sidebar from "./Sidebar";
import styles from "./styles.module.css";

export default function ProfileLayout({ children }) {
  return (
    <div className={styles.layoutContainer}>
      <Sidebar />
      <PageWrapper>{children}</PageWrapper>
    </div>
  );
}
