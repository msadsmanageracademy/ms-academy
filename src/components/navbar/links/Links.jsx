"use client";

import { Hamburger } from "@/components/icons/Hamburger";
import { useSession, signOut } from "next-auth/react";
import styles from "./styles.module.css";
import NavLink from "./navLink/NavLink";
import { useState } from "react";

const links = [
  { title: "Inicio", path: "/" },
  { title: "Clases", path: "/classes" },
  { title: "Contacto", path: "/contact" },
];

const Links = () => {
  const [open, setOpen] = useState(false);

  const { data: session, status } = useSession(); // Obtener datos de la sesión

  console.log(session);

  return (
    <>
      <div className={styles.navbar}>
        {links.map((link) => (
          <NavLink key={link.path} item={link} />
        ))}
        {session ? (
          <>
            <NavLink item={{ title: "Mi perfil", path: "/profile" }} />
          </>
        ) : (
          <>
            <NavLink item={{ title: "Iniciar sesión", path: "/auth/login" }} />
            <NavLink item={{ title: "Registrarse", path: "/auth/register" }} />
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
        {session ? (
          <>
            <NavLink item={{ title: "Mi perfil", path: "/profile" }} />
          </>
        ) : (
          <>
            <NavLink item={{ title: "Iniciar sesión", path: "/auth/login" }} />
            <NavLink item={{ title: "Registrarse", path: "/auth/register" }} />
          </>
        )}
      </div>
    </>
  );
};

export default Links;
