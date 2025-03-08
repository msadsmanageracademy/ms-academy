"use client";

import withReactContent from "sweetalert2-react-content";
import { PlusSign } from "@/components/icons/PlusSign";
import { signOut, useSession } from "next-auth/react";
import { Pencil } from "@/components/icons/Pencil";
import { Logout } from "@/components/icons/Logout";
import { Delete } from "@/components/icons/Delete";
import { UserId } from "@/components/icons/UserId";
import { useMediaQuery } from "react-responsive";
import { Users } from "@/components/icons/Users";
import { User } from "@/components/icons/User";
import { List } from "@/components/icons/List";
import { usePathname } from "next/navigation";
import styles from "./styles.module.css";
import Swal from "sweetalert2";
import Link from "next/link";

const Sidebar = () => {
  const isXL = useMediaQuery({ query: "(min-width: 1200px)" });
  const isL = useMediaQuery({ query: "(min-width: 992px)" });
  const isM = useMediaQuery({ query: "(min-width: 768px)" });
  const isSm = useMediaQuery({ query: "(min-width: 576px)" });
  const isXS = useMediaQuery({ query: "(min-width: 400px)" });

  const { data: session, status } = useSession();

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

  if (status === "loading") return null; // No muestro el sidebar hasta que la sesión haya cargado, esto elimina problema de parpadeo

  return (
    <nav className={`${styles.sidebar} ${!isM ? styles.mobile : ""}`}>
      <ul>
        {/* Enlaces comunes para todos los usuarios */}
        <li>
          <Link
            href="/account"
            className={pathname === "/account" ? `${styles.active}` : ""}
          >
            <User
              size={28}
              stroke={pathname === "/account" ? "#f4a462" : "#fff"}
            />
            {isM && session?.user.first_name}
          </Link>
        </li>
        <li>
          <Link
            href="/account/edit"
            className={pathname === "/account/edit" ? `${styles.active}` : ""}
          >
            <UserId
              size={28}
              stroke={pathname === "/account/edit" ? "#f4a462" : "#fff"}
            />
            {isM && "Mis datos"}
          </Link>
        </li>

        {/* Opciones específicas para el usuario regular */}
        {!session?.user?.role || session.user.role === "user" ? (
          <li>
            <Link
              href="/account/my-classes"
              className={
                pathname === "/account/my-classes" ? `${styles.active}` : ""
              }
            >
              <List
                size={28}
                stroke={pathname === "/account/my-classes" ? "#f4a462" : "#fff"}
              />
              {isM && "Mis clases"}
            </Link>
          </li>
        ) : null}

        {/* Opciones específicas para el admin */}
        {session?.user?.role === "admin" ? (
          <>
            <li>
              <Link
                href="/account/create-events"
                className={
                  pathname === "/account/create-events"
                    ? `${styles.active}`
                    : ""
                }
              >
                <PlusSign
                  size={28}
                  stroke={
                    pathname === "/account/create-events" ? "#f4a462" : "#fff"
                  }
                />
                {isM && "Crear"}
              </Link>
            </li>
            <li>
              <Link
                href="/account/edit-events"
                className={
                  pathname.startsWith("/account/edit-events")
                    ? `${styles.active}`
                    : ""
                }
              >
                <Pencil
                  size={28}
                  stroke={
                    pathname.startsWith("/account/edit-events")
                      ? "#f4a462"
                      : "#fff"
                  }
                />
                {isM && "Editar"}
              </Link>
            </li>
          </>
        ) : null}
        <li className={styles.logoutContainer} onClick={() => handleLogout()}>
          <Logout size={28} />
          {isM && "Cerrar sesión"}
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;
