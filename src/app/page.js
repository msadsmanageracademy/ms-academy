import styles from "./styles.module.css";
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.heroHeader}>
          <div className={styles.heroImage}>Imagen hero (portada)</div>
          <div className={styles.heroText}>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit.
              Exercitationem harum molestias expedita est, accusantium sed
              dolorem unde obcaecati illum. Tempora?
            </p>
            <Link
              href="/schedule"
              className={`button-primary ${styles.heroButton}`}
            >
              Consultar disponibilidad
            </Link>
          </div>
        </div>
      </div>
      <div className={styles.description}>
        <h1>
          Capacitate con <span>Maximiliano Setzes</span> en{" "}
          <span>publicidad digital</span> para llevar tu <span>negocio</span> al
          siguiente nivel
        </h1>
        <ul>
          <li>¿Qué aprenderán los usuarios?</li>
          <li>
            ¿Cómo es la modalidad (virtual/presencial, individual/grupal)?
          </li>
          <li>¿Qué diferencia estas capacitaciones de otras?</li>
          <li>Un programa resumido con los temas clave.</li>
        </ul>
      </div>
      <div className={styles.aboutMe}>
        <ul>
          <li>Formación y experiencia en el área.</li>
          <li>Empresas o instituciones con las que trabajó.</li>
          <li>Logros, certificaciones o proyectos destacados.</li>
          <li>Una foto del cliente para darle un toque más personal.</li>
        </ul>
        <Link
          href="/about-me"
          className={`button-primary ${styles.aboutMeButton}`}
        >
          Conocé más sobre mí
        </Link>
      </div>
      <div className={styles.reviews}>
        <h3>Esto se podría mostrar como un carrusel</h3>
        <ul>
          <li>Capacitaciones pasadas.</li>
          <li>
            Exalumnos, compañeros de trabajo o empresas con las que ha
            colaborado. Cada testimonio podría estar asociado de una foto si la
            persona da permiso.
          </li>
          <li> Reseñas de LinkedIn o redes sociales.</li>
        </ul>
      </div>
      <div className={styles.faq}>
        <h3>FAQ (Preguntas frecuentes): podría mostrarse como acordeón</h3>
        <ul>
          <li>¿Cómo se reservan las clases?</li>
          <li>¿Cuánto duran?</li>
          <li>¿Hay materiales de apoyo?</li>
          <li>¿Qué plataforma se usa (Zoom, Meet, etc.)?</li>
          <li>¿Cuáles son los métodos de pago?</li>
        </ul>
      </div>
      <div className={styles.resources}>
        <h3>Posicionarse como experto: recursos gratuitos</h3>
        <ul>
          <li>Artículos con consejos sobre el tema de las capacitaciones.</li>
          <li>Recursos gratuitos (ejemplo: PDFs, videos cortos).</li>
          <li>Casos de éxito o experiencias.</li>
        </ul>
      </div>
    </div>
  );
}
