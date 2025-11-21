"use client";

import { Cross } from "@/views/components/icons/Cross";
import { Hamburger } from "@/views/components/icons/Hamburger";
import ICONS from "./iconsMap";
import Link from "next/link";
import MENU from "./menu";
import { NavbarArrow } from "@/views/components/icons";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./styles.module.css";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

const Navbar = ({ menu = MENU }) => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const dropdownRefs = useRef({});
  const mobileRef = useRef(null);

  // Filter menu items based on protected status
  const filteredMenu = menu.filter((item) => {
    if (item.protected && !session) return false;
    if (item.hideWhenAuthenticated && session) return false;
    if (item.submenu) {
      item.submenu = item.submenu.filter((subitem) => {
        if (subitem.protected && !session) return false;
        if (subitem.hideWhenAuthenticated && session) return false;
        return true;
      });
    }
    return true;
  });

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setOpenSubmenu(null);
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

  // consolidated outside-click handler: close mobile menu or desktop submenu when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      const target = e.target;

      // if mobile is open and the click is outside the mobile menu, close both
      if (mobileOpen) {
        if (!mobileRef.current || !mobileRef.current.contains(target)) {
          setMobileOpen(false);
          setOpenSubmenu(null);
          return;
        }
        // click inside mobile menu -> do nothing
        return;
      }

      // if a desktop submenu is open, close it when click is outside its dropdown container
      if (openSubmenu != null) {
        const ref = dropdownRefs.current[openSubmenu];
        if (!ref || !ref.contains(target)) {
          setOpenSubmenu(null);
        }
      }
    }

    const shouldListen = mobileOpen || openSubmenu != null;
    if (shouldListen) document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [mobileOpen, openSubmenu]);

  useEffect(() => {
    // close any open dropdowns / mobile panel when navigating
    setOpenSubmenu(null);
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (item) => {
    if (!pathname) return false;
    if (item.href) {
      if (item.href === "/") return pathname === "/";
      // For parent sections like /solutions: only mark active on exact path
      if (item.href === "/solutions") return pathname === "/solutions";
      try {
        return pathname === item.href || pathname.startsWith(item.href + "/");
      } catch (e) {
        return pathname === item.href || pathname.startsWith(item.href);
      }
    }

    if (item.submenu && Array.isArray(item.submenu)) {
      if (item.href) return false;
      return item.submenu.some((s) => {
        if (!s.href) return false;
        if (s.href === "/") return pathname === "/";
        return pathname === s.href || pathname.startsWith(s.href + "/");
      });
    }
    return false;
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logo} aria-label="">
            LOGO
          </Link>
        </div>
        <nav className={styles.nav} aria-label="Main navigation">
          <ul
            className={styles.desktopMenu}
            style={
              !styles || !styles.desktopMenu
                ? {
                    alignItems: "center",
                    display: "flex",
                    gap: "1rem",
                    listStyle: "none",
                  }
                : undefined
            }
          >
            {filteredMenu.map((item, i) => (
              <li key={i} className={styles.item}>
                {item.submenu ? (
                  <div
                    className={styles.dropdown}
                    ref={(el) => {
                      if (el) dropdownRefs.current[i] = el;
                      else delete dropdownRefs.current[i];
                    }}
                  >
                    <button
                      className={`${styles.dropToggle} ${
                        isActive(item) ? styles.active : ""
                      }`}
                      aria-haspopup="true"
                      aria-expanded={openSubmenu === i}
                      onClick={() =>
                        setOpenSubmenu(openSubmenu === i ? null : i)
                      }
                    >
                      {item.label}
                      <motion.span
                        className={styles.rotatingIcon}
                        animate={
                          openSubmenu === i ? { rotate: 180 } : { rotate: 0 }
                        }
                        transition={{ duration: 0.2 }}
                      >
                        <NavbarArrow width={24} height={24} />
                      </motion.span>
                    </button>
                    <AnimatePresence>
                      {openSubmenu === i && (
                        <motion.ul
                          key={`submenu-${i}`}
                          className={styles.submenu}
                          role="menu"
                          initial={{ opacity: 0, y: -8, scale: 0.99 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.99 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                          <div className={styles.submenuInner}>
                            {item.submenu.map((s, si) => (
                              <li
                                key={si}
                                className={`${styles.submenuListItem} ${
                                  s.href.startsWith("/solutions")
                                    ? styles.solutions
                                    : ""
                                }`}
                              >
                                <Link
                                  href={s.href}
                                  className={`${styles.linkWithIcon} ${
                                    isActive(s) ? styles.active : ""
                                  }`}
                                  role="menuitem"
                                >
                                  <div className={styles.labelContainer}>
                                    {s.iconKey && ICONS[s.iconKey] ? (
                                      <span
                                        className={`${styles.icon} ${
                                          isActive(s) ? styles.activeIcon : ""
                                        }`}
                                        aria-hidden
                                      >
                                        {React.createElement(ICONS[s.iconKey], {
                                          width: 20,
                                          height: 20,
                                        })}
                                      </span>
                                    ) : null}
                                    <span>{s.label}</span>
                                  </div>
                                  {s.description ? (
                                    <span className={styles.description}>
                                      {s.description}
                                    </span>
                                  ) : null}
                                </Link>
                              </li>
                            ))}
                          </div>
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.link} ${
                      isActive(item) ? styles.active : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
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
            <motion.ul className={styles.mobileList}>
              {filteredMenu.map((item, i) => (
                <motion.li
                  key={i}
                  className={`${styles.mobileListItem} ${
                    openSubmenu === i ? styles.mobileListItemOpen : ""
                  }`}
                  animate={
                    openSubmenu === i
                      ? {
                          borderColor: "var(--palette-3)",
                          boxShadow: "0px 1px 7px 0px var(--palette-3)",
                        }
                      : { borderColor: "#bbbbbb", boxShadow: "none" }
                  }
                  transition={{ duration: 0.2 }}
                >
                  {item.submenu ? (
                    <button
                      aria-expanded={openSubmenu === i}
                      onClick={(e) => {
                        const closing = openSubmenu === i;
                        setOpenSubmenu(closing ? null : i);
                        // remove focus/active state when closing so CSS :active/:focus-within stops applying
                        if (
                          closing &&
                          e &&
                          e.currentTarget &&
                          typeof e.currentTarget.blur === "function"
                        ) {
                          e.currentTarget.blur();
                        }
                      }}
                      className={styles.mobileSubToggle}
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
                              width: 24,
                              height: 24,
                            })}
                          </span>
                        ) : null}
                        <motion.span
                          key={i}
                          animate={
                            openSubmenu === i || isActive(item)
                              ? { color: "var(--palette-3)" }
                              : { color: "#fff" }
                          }
                          transition={{ duration: 0.2 }}
                        >
                          {item.label}
                        </motion.span>
                        <motion.span
                          className={styles.rotatingIcon}
                          animate={
                            openSubmenu === i ? { rotate: 180 } : { rotate: 0 }
                          }
                          transition={{ duration: 0.2 }}
                        >
                          <NavbarArrow width={24} height={24} />
                        </motion.span>
                      </div>
                      {item.description ? (
                        <span className={styles.description}>
                          {item.description}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={`${styles.linkWithIcon} ${styles.mobile} ${
                        isActive(item) ? styles.active : ""
                      }`}
                      role="menuitem"
                      onClick={(e) => {
                        if (
                          e &&
                          e.currentTarget &&
                          typeof e.currentTarget.blur === "function"
                        ) {
                          e.currentTarget.blur();
                        }
                        setMobileOpen(false);
                      }}
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
                              fill: isActive(item)
                                ? "var(--palette-3)"
                                : "#fff",
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
                  )}
                  <AnimatePresence>
                    {item.submenu && openSubmenu === i && (
                      <motion.ul
                        className={styles.mobileSubmenu}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.submenu.map((s, si) => (
                          <li key={si}>
                            <a
                              href={s.href}
                              className={`${styles.mobileSublink} ${
                                isActive(s) ? styles.active : ""
                              }`}
                            >
                              {s.iconKey && ICONS[s.iconKey] ? (
                                <span
                                  className={`${styles.mobileSubIcon} ${
                                    isActive(s) ? styles.activeIcon : ""
                                  }`}
                                  aria-hidden
                                >
                                  {React.createElement(ICONS[s.iconKey], {
                                    width: 18,
                                    height: 18,
                                  })}
                                </span>
                              ) : null}
                              <span>{s.label}</span>
                            </a>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
