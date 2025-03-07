"use client";

import { Hamburger } from "@/components/icons/Hamburger";
import { Notebook } from "@/components/icons/Notebook";
import { Register } from "@/components/icons/Register";
import { Letter } from "@/components/icons/Letter";
import { Users } from "@/components/icons/Users";
import { Login } from "@/components/icons/Login";
import { Home } from "@/components/icons/Home";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./styles.module.css";
import { useState } from "react";
import Link from "next/link";

const Links = () => {
  const [open, setOpen] = useState(false);

  const { data: session, status } = useSession(); // Obtener datos de la sesión

  const pathname = usePathname();

  return (
    <>
      <div className={styles.navbar}>
        <ul>
          <li>
            <Link
              href={"/"}
              className={`${styles.navLink} ${
                pathname === "/" ? styles.active : ""
              }`}
              onClick={() => setOpen(false)}
            >
              Inicio
            </Link>
          </li>
          <li>
            <Link
              href={"/classes"}
              className={`${styles.navLink} ${
                pathname.startsWith("/classes") ? styles.active : ""
              }`}
              onClick={() => setOpen(false)}
            >
              Próximas actividades
            </Link>
          </li>
          <li>
            <Link
              href={"/contact"}
              className={`${styles.navLink} ${
                pathname === "/contact" ? styles.active : ""
              }`}
              onClick={() => setOpen(false)}
            >
              Contacto
            </Link>
          </li>
          {session ? (
            <li>
              <Link
                href={"/profile"}
                className={`${styles.navLink} ${
                  pathname.startsWith("/profile") ? styles.active : ""
                }`}
                onClick={() => setOpen(false)}
              >
                Mi perfil
              </Link>
            </li>
          ) : (
            <>
              <li>
                <Link
                  href={"/auth/login"}
                  className={`${styles.navLink} ${
                    pathname === "/auth/login" ? styles.active : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link
                  href={"/auth/register"}
                  className={`${styles.navLink} ${
                    pathname === "/auth/register" ? styles.active : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  Registrarse
                </Link>
              </li>
            </>
          )}
        </ul>
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
        <ul>
          <li>
            <Link
              href={"/"}
              className={`${styles.navLink} ${
                pathname === "/" ? styles.active : ""
              }`}
              onClick={() => setOpen(false)}
            >
              <Home size={28} stroke={pathname === "/" ? "#f4a462" : "#fff"} />
              Inicio
            </Link>
          </li>
          <li>
            <Link
              href={"/classes"}
              className={`${styles.navLink} ${
                pathname.startsWith("/classes") ? styles.active : ""
              }`}
              onClick={() => setOpen(false)}
            >
              <Notebook
                size={28}
                stroke={pathname.startsWith("/classes") ? "#f4a462" : "#fff"}
              />
              Próximas actividades
            </Link>
          </li>
          <li>
            <Link
              href={"/contact"}
              className={`${styles.navLink} ${
                pathname === "/contact" ? styles.active : ""
              }`}
              onClick={() => setOpen(false)}
            >
              <Letter
                size={28}
                stroke={pathname === "/contact" ? "#f4a462" : "#fff"}
              />
              Contacto
            </Link>
          </li>
          {session ? (
            <li>
              <Link
                href={"/profile"}
                className={`${styles.navLink} ${
                  pathname.startsWith("/profile") ? styles.active : ""
                }`}
                onClick={() => setOpen(false)}
              >
                <Users
                  size={28}
                  stroke={pathname.startsWith("/profile") ? "#f4a462" : "#fff"}
                />
                Mi perfil
              </Link>
            </li>
          ) : (
            <>
              <li>
                <Link
                  href={"/auth/login"}
                  className={`${styles.navLink} ${
                    pathname === "/auth/login" ? styles.active : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <Login
                    size={28}
                    stroke={pathname === "/auth/login" ? "#f4a462" : "#fff"}
                  />
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link
                  href={"/auth/register"}
                  className={`${styles.navLink} ${
                    pathname === "/auth/register" ? styles.active : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <Register
                    size={28}
                    stroke={pathname === "/auth/register" ? "#f4a462" : "#fff"}
                  />
                  Registrarse
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </>
  );
};

export default Links;
