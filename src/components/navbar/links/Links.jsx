"use client";

import { Hamburger } from "@/components/icons/Hamburger";
import { useSession } from "next-auth/react";
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

  return (
    <>
      <div className={styles.navbar}>
        {links.map((link) => (
          <NavLink key={link.path} item={link} onClick={() => setOpen(false)} />
        ))}
        {session ? (
          <>
            <NavLink
              item={{ title: "Mi perfil", path: "/profile" }}
              onClick={() => setOpen(false)}
            />
          </>
        ) : (
          <>
            <NavLink
              item={{ title: "Iniciar sesión", path: "/auth/login" }}
              onClick={() => setOpen(false)}
            />
            <NavLink
              item={{ title: "Registrarse", path: "/auth/register" }}
              onClick={() => setOpen(false)}
            />
          </>
        )}
      </div>
      <button
        className={styles.menuButton}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="navbarMobile" // Debe ser el id de la navbar mobile (accesibilidad)
      >
        <Hamburger size={20} />
      </button>
      <div
        id="navbarMobile"
        className={`${styles.navbarMobile} ${open ? styles.open : ""}`}
      >
        {links.map((link) => (
          <NavLink key={link.path} item={link} onClick={() => setOpen(false)} />
        ))}
        {session ? (
          <>
            <NavLink
              item={{ title: "Mi perfil", path: "/profile" }}
              onClick={() => setOpen(false)}
            />
          </>
        ) : (
          <>
            <NavLink
              item={{ title: "Iniciar sesión", path: "/auth/login" }}
              onClick={() => setOpen(false)}
            />
            <NavLink
              item={{ title: "Registrarse", path: "/auth/register" }}
              onClick={() => setOpen(false)}
            />
          </>
        )}
      </div>
    </>
  );
};

export default Links;
