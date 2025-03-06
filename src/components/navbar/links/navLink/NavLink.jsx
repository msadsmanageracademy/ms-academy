"use client";

import Link from "next/link";
import styles from "./styles.module.css";
import { usePathname } from "next/navigation";

const NavLink = ({ item, onClick }) => {
  const pathName = usePathname();

  return (
    <Link
      href={item.path}
      className={`${styles.navLink} ${
        item.path === "/"
          ? pathName === "/" && styles.active
          : pathName.startsWith(item.path) && styles.active
      }`} // Para que no reconozca "/" como activo siempre
      onClick={onClick}
    >
      {item.title}
    </Link>
  );
};

export default NavLink;
