import Image from "next/image";
import Link from "next/link";
import styles from "./styles.module.css";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/content", label: "Próximas actividades" },
  { href: "/about", label: "Sobre mí" },
];

const accountLinks = [
  { href: "/login", label: "Ingresar" },
  { href: "/register", label: "Crear cuenta" },
  { href: "/dashboard", label: "Mi panel" },
];

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/images/logo.png"
              alt="MS Academy"
              width={120}
              height={40}
              className={styles.logo}
            />
          </Link>
          <p className={styles.tagline}>
            Capacitaciones en publicidad digital 100% online.
          </p>
        </div>
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>Navegación</h3>
          <ul className={styles.linkList}>
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={styles.link}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>Mi cuenta</h3>
          <ul className={styles.linkList}>
            {accountLinks.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={styles.link}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>Contacto</h3>
          <ul className={styles.linkList}>
            <li>
              <Link href="/contact" className={styles.link}>
                Enviar mensaje
              </Link>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/maximilianosetzes/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className={styles.bottom}>
        <p className={styles.copy}>
          &copy; {year} MS Academy · Todos los derechos reservados
        </p>
      </div>
    </footer>
  );
};

export default Footer;
