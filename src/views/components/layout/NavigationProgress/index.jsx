"use client";

import styles from "./styles.module.css";
import {
  finishNavigation,
  getNavigationPhase,
  subscribeNavigation,
} from "@/lib/navigationProgress";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgress() {
  const phase = useSyncExternalStore(subscribeNavigation, getNavigationPhase, () => "idle");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    finishNavigation();
  }, [pathname, searchParams]);

  if (phase === "idle") return null;

  return (
    <div aria-hidden="true" className={styles.track} data-navigation-progress>
      <div className={`${styles.bar} ${phase === "loading" ? styles.loading : styles.finishing}`} />
    </div>
  );
}
