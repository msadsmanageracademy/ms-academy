"use client";

import withReactContent from "sweetalert2-react-content";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import styles from "./styles.module.css";
import Swal from "sweetalert2";
import Link from "next/link";

export default function Sidebar() {
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
    }).then((result) => {
      if (result.isConfirmed) {
        signOut({ callbackUrl: "/auth/login" });
      }
    });
  };

  const pathname = usePathname();

  const links = [
    { href: "/profile", label: "Inicio" },
    { href: "/profile/settings", label: "Configuración" },
  ];
  return (
    <nav className={styles.sidebar}>
      <h2>Dashboard</h2>
      <ul>
        {/* Enlaces comunes para todos los usuarios */}
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={pathname === href ? `${styles.active}` : ""}
            >
              {label}
            </Link>
          </li>
        ))}

        {/* Opciones específicas para el usuario regular */}
        {!session?.user?.role || session.user.role === "user" ? (
          <li>
            <a
              href="/profile/classes"
              className={
                pathname === "/profile/classes" ? `${styles.active}` : ""
              }
            >
              Mis Clases
            </a>
          </li>
        ) : null}

        {/* Opciones específicas para el admin */}
        {session?.user?.role === "admin" ? (
          <>
            <li>
              <a
                href="/profile/admin"
                className={
                  pathname === "/profile/admin" ? `${styles.active}` : ""
                }
              >
                Definir Horarios
              </a>
            </li>
          </>
        ) : null}
        <button onClick={() => handleLogout()}>Cerrar sesión</button>
      </ul>
    </nav>
  );
}
