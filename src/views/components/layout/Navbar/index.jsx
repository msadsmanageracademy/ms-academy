"use client";

import ICONS from "./iconsMap";
import Image from "next/image";
import Link from "next/link";
import MENU from "./menu";
import styles from "./styles.module.css";
import { useNotifications } from "@/providers/NotificationProvider";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Cross, Hamburger } from "@/views/components/icons";
import React, { useEffect, useRef, useState } from "react";

const Navbar = ({ menu = MENU }) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { unreadCount } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef(null);

  // Filter menu items based on protected status
  const filteredMenu = menu.filter((item) => {
    if (item.protected && !session) return false;
    if (item.hideWhenAuthenticated && session) return false;
    return true;
  });

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 768) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      const target = e.target;
      if (mobileOpen) {
        if (!mobileRef.current || !mobileRef.current.contains(target)) {
          setMobileOpen(false);
        }
      }
    }

    if (mobileOpen) document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (item) => {
    if (!pathname || !item.href) return false;
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logoLink} aria-label="">
            <Image
              alt="MS Academy Logo"
              height={300}
              src="/images/logo-2.png"
              width={300}
            />
          </Link>
        </div>
        <nav className={styles.nav} aria-label="Main navigation">
          <ul className={styles.desktopMenu}>
            {filteredMenu.map((item, i) => (
              <li key={i} className={styles.item}>
                <Link
                  href={item.href}
                  className={`${styles.link} ${
                    isActive(item) ? styles.active : ""
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {session && (
              <li className={styles.item}>
                <Link
                  href="/dashboard/notifications"
                  className={`${styles.link} ${styles.notificationLink} ${
                    pathname === "/dashboard/notifications" ? styles.active : ""
                  }`}
                  aria-label={`Notifications ${
                    unreadCount > 0 ? `(${unreadCount} unread)` : ""
                  }`}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className={styles.badge}>{unreadCount}</span>
                  )}
                </Link>
              </li>
            )}
          </ul>

          <button
            className={`${styles.hamburger} ${mobileOpen ? styles.open : ""}`}
            aria-controls="mobile-menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {!mobileOpen ? (
              <Hamburger width={24} height={20} />
            ) : (
              <Cross width={24} height={24} />
            )}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            ref={mobileRef}
            className={styles.mobileMenu}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ul className={styles.mobileList}>
              {filteredMenu.map((item, i) => (
                <li key={i} className={styles.mobileListItem}>
                  <Link
                    href={item.href}
                    className={`${styles.linkWithIcon} ${styles.mobile} ${
                      isActive(item) ? styles.active : ""
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <div className={styles.labelContainer}>
                      {item.iconKey && ICONS[item.iconKey] ? (
                        <span
                          className={`${styles.icon} ${
                            isActive(item) ? styles.activeIcon : ""
                          }`}
                          aria-hidden
                        >
                          {React.createElement(ICONS[item.iconKey], {
                            fill: isActive(item) ? "var(--color-2)" : "#fff",
                            height: 24,
                            width: 24,
                          })}
                        </span>
                      ) : null}
                      <span>{item.label}</span>
                    </div>
                    {item.description ? (
                      <span className={styles.description}>
                        {item.description}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
