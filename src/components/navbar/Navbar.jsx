import styles from "./styles.module.css";
import Links from "./links/Links";
import Link from "next/link";

const Navbar = async () => {
  return (
    <div className={styles.container}>
      <Link className={styles.logo} href="/">
        LOGO
      </Link>
      <Links />
    </div>
  );
};

export default Navbar;
