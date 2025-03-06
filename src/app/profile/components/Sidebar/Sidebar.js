"use client";

import withReactContent from "sweetalert2-react-content";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import styles from "./styles.module.css";
import Swal from "sweetalert2";
import Link from "next/link";

const Sidebar = () => {
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
    }).then((result) => {
      if (result.isConfirmed) {
        signOut({ callbackUrl: "/auth/login" });
      }
    });
  };

  const pathname = usePathname();

  const links = [
    { href: "/profile", label: "Inicio" },
    { href: "/profile/settings", label: "Editar perfil" },
  ];

  if (status === "loading") return null; // No muestro el sidebar hasta que la sesión haya cargado, esto elimina problema de parpadeo

  return (
    <nav className={styles.sidebar}>
      <div className={styles.sidebarTitle}>Dashboard</div>
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
            <Link
              href="/profile/classes"
              className={
                pathname === "/profile/classes" ? `${styles.active}` : ""
              }
            >
              Mis Clases
            </Link>
          </li>
        ) : null}

        {/* Opciones específicas para el admin */}
        {session?.user?.role === "admin" ? (
          <>
            <li>
              <Link
                href="/profile/admin"
                className={
                  pathname === "/profile/admin" ? `${styles.active}` : ""
                }
              >
                Crear cursos/clases
              </Link>
            </li>
            <li>
              <Link
                href="/profile/stats"
                className={
                  pathname === "/profile/stats" ? `${styles.active}` : ""
                }
              >
                Estadísticas
              </Link>
            </li>
          </>
        ) : null}
        <button onClick={() => handleLogout()} className="button-secondary">
          Cerrar sesión
        </button>
      </ul>
    </nav>
  );
};

export default Sidebar;
