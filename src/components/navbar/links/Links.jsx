"use client";

import { Hamburger } from "@/components/icons/Hamburger";
// import { useSession } from "@/context/SessionContext";
import styles from "./styles.module.css";
import NavLink from "./navLink/NavLink";
import { useState } from "react";

const links = [
  { title: "Inicio", path: "/" },
  { title: "Calendario", path: "/schedule" },
  { title: "Sobre mí", path: "/about-me" },
  { title: "Contacto", path: "/contact" },
];

const Links = () => {
  const [open, setOpen] = useState(false);

  // const { userSession, logout } = useSession();

  // const isAdmin = false; // TEMPORARY

  const userSession = false; // TEMPORARY

  return (
    <>
      <div className={styles.navbar}>
        {links.map((link) => (
          <NavLink key={link.path} item={link} />
        ))}
        {userSession ? (
          <>
            <NavLink item={{ title: "Mi perfil", path: "/profile" }} />
            <button className={styles.logout} onClick={logout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <NavLink item={{ title: "Iniciar sesión", path: "/login" }} />
            <NavLink item={{ title: "Registrarse", path: "/register" }} />
          </>
        )}
      </div>
      <button
        className={styles.menuButton}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <Hamburger size={24} />
      </button>
      <div className={`${styles.navbarMobile} ${open ? styles.open : ""}`}>
        {links.map((link) => (
          <NavLink key={link.path} item={link} />
        ))}
        {userSession ? (
          <>
            <NavLink item={{ title: "Mi perfil", path: "/profile" }} />
            <button className={styles.logout} onClick={logout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <NavLink item={{ title: "Iniciar sesión", path: "/login" }} />
            <NavLink item={{ title: "Registrarse", path: "/register" }} />
          </>
        )}
      </div>
    </>
  );
};

export default Links;
