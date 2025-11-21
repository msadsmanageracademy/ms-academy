import LoginForm from "./components/LoginForm";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";

const CredentialsSection = ({ handleGoogleLogin }) => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>Ingresá a tu cuenta</div>
      <PrimaryLink
        asButton
        google
        onClick={handleGoogleLogin}
        text={"Iniciar sesión con Google"}
      />
      <LoginForm />
    </div>
  );
};

export default CredentialsSection;
