import LoginForm from "./components/LoginForm";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";

const CredentialsSection = ({ handleGoogleLogin }) => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Ingresá a tu cuenta</h1>
      <PrimaryLink
        asButton
        dark
        google
        onClick={handleGoogleLogin}
        text={"Iniciar sesión con Google"}
      />
      <LoginForm />
    </div>
  );
};

export default CredentialsSection;
