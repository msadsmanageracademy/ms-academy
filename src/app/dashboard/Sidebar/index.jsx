"use client";

import Link from "next/link";
import SIDEBAR_MENU from "./menu";
import Swal from "sweetalert2";
import styles from "./styles.module.css";
import { usePathname } from "next/navigation";
import withReactContent from "sweetalert2-react-content";
import {
  Bell,
  Courses,
  Logout,
  NavbarClasses,
  Pencil,
  User,
  UserId,
} from "@/views/components/icons";
import { signOut, useSession } from "next-auth/react";

const ICONS = {
  Bell,
  Courses,
  NavbarClasses,
  Pencil,
  User,
  UserId,
};

const Sidebar = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const MySwal = withReactContent(Swal);

  const handleLogout = () => {
    MySwal.fire({
      title: "Cerrar sesión",
      text: "¿Está seguro que desea cerrar la sesión?",
      icon: "info",
      showCancelButton: true,
      confirmButtonColor: "var(--success)",
      cancelButtonColor: "#292c33",
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        signOut({ callbackUrl: "/login" });
      }
    });
  };

  const isActive = (href) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const filteredMenu = SIDEBAR_MENU.filter((item) =>
    item.roles.includes(session?.user?.role)
  );

  return (
    <nav className={styles.sidebar}>
      <ul>
        {filteredMenu.map((item) => {
          const Icon = ICONS[item.iconKey];
          const label =
            typeof item.label === "function" ? item.label(session) : item.label;
          const active = isActive(item.href);

          return (
            <li className={styles.item} key={item.href}>
              <Link
                href={item.href}
                className={`${styles.link} ${active ? styles.active : ""}`}
              >
                <Icon
                  fill={active ? "var(--color-2)" : "rgba(255, 255, 255, 0.7)"}
                  size={28}
                />
                <span className={styles.label}>{label}</span>
              </Link>
            </li>
          );
        })}
        <li
          className={`${styles.item} ${styles.logoutContainer}`}
          onClick={() => handleLogout()}
        >
          <Logout fill={"rgba(255, 255, 255, 0.7)"} size={28} />
          <span>Cerrar sesión</span>
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;
