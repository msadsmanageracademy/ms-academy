"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import Sidebar from "./components/Sidebar/Sidebar";
import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import { useRouter } from "next/navigation";
import styles from "./layout.module.css";

export default function ProfileLayout({ children }) {
  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.dashboard}>{children}</div>
    </div>
  );
}
