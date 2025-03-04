import withReactContent from "sweetalert2-react-content";
import Sidebar from "../Sidebar/Sidebar";
import styles from "./styles.module.css";
import Swal from "sweetalert2";

const DashboardLayout = ({ user, signOut, children }) => {
  return (
    <div className={styles.container}>
      <header>
        <h1>Bienvenido, {user.email}</h1>
      </header>
      <main>{children}</main>
    </div>
  );
};

export default DashboardLayout;
