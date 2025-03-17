"use client";

import withReactContent from "sweetalert2-react-content";
import { PlusSign } from "@/components/icons/PlusSign";
import { signOut, useSession } from "next-auth/react";
import { Pencil } from "@/components/icons/Pencil";
import { Logout } from "@/components/icons/Logout";
import { Delete } from "@/components/icons/Delete";
import { UserId } from "@/components/icons/UserId";
import { Users } from "@/components/icons/Users";
import { User } from "@/components/icons/User";
import { List } from "@/components/icons/List";
import { usePathname } from "next/navigation";
import styles from "./styles.module.css";
import Swal from "sweetalert2";
import Link from "next/link";

const Sidebar = () => {
  const { data: session } = useSession();

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
        signOut({ callbackUrl: "/auth/login" });
      }
    });
  };

  const pathname = usePathname();

  return (
    <nav className={styles.sidebar}>
      <ul>
        {/* Enlaces comunes para todos los usuarios */}
        <li>
          <Link
            href="/dashboard"
            className={pathname === "/dashboard" ? `${styles.active}` : ""}
          >
            <User
              size={28}
              stroke={pathname === "/dashboard" ? "#f4a462" : "#fff"}
            />
            <span>{session?.user.name || "Usuario"}</span>
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/account"
            className={
              pathname === "/dashboard/account" ? `${styles.active}` : ""
            }
          >
            <UserId
              size={28}
              stroke={pathname === "/dashboard/account" ? "#f4a462" : "#fff"}
            />
            <span>Mis datos</span>
          </Link>
        </li>

        {/* Opciones específicas para el usuario regular */}
        {session?.user.role === "user" ? (
          <li>
            <Link
              href="/dashboard/my-classes"
              className={
                pathname === "/dashboard/my-classes" ? `${styles.active}` : ""
              }
            >
              <List
                size={28}
                stroke={
                  pathname === "/dashboard/my-classes" ? "#f4a462" : "#fff"
                }
              />
              <span>Mis clases</span>
            </Link>
          </li>
        ) : null}
        {/* Opciones específicas para el admin */}
        {session?.user?.role === "admin" ? (
          <>
            <li>
              <Link
                href="/dashboard/create-events"
                className={
                  pathname === "/dashboard/create-events"
                    ? `${styles.active}`
                    : ""
                }
              >
                <PlusSign
                  size={28}
                  stroke={
                    pathname === "/dashboard/create-events" ? "#f4a462" : "#fff"
                  }
                />
                <span>Crear</span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/edit-events"
                className={
                  pathname.startsWith("/dashboard/edit-events")
                    ? `${styles.active}`
                    : ""
                }
              >
                <Pencil
                  size={28}
                  stroke={
                    pathname.startsWith("/dashboard/edit-events")
                      ? "#f4a462"
                      : "#fff"
                  }
                />
                <span>Editar</span>
              </Link>
            </li>
          </>
        ) : null}
        <li className={styles.logoutContainer} onClick={() => handleLogout()}>
          <Logout size={28} />
          <span>Cerrar sesión</span>
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;
