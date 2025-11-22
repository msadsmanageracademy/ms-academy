"use client";

import Link from "next/link";
import SIDEBAR_MENU from "./menu";
import Swal from "sweetalert2";
import styles from "./styles.module.css";
import { usePathname } from "next/navigation";
import withReactContent from "sweetalert2-react-content";
import {
  Logout,
  NavbarClasses,
  NavbarDashboard,
  Pencil,
  User,
  UserId,
} from "@/views/components/icons";
import { signOut, useSession } from "next-auth/react";

const ICONS = {
  User,
  UserId,
  NavbarClasses,
  NavbarDashboard,
  Pencil,
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
      confirmButtonColor: "#1aa849",
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
            <li key={item.href}>
              <Link href={item.href} className={active ? styles.active : ""}>
                <Icon size={28} stroke={active ? "#f4a462" : "#fff"} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className={styles.logoutContainer} onClick={() => handleLogout()}>
          <Logout size={28} />
          <span>Cerrar sesión</span>
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;
