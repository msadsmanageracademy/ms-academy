import { Star } from "@/views/components/icons";
import styles from "./styles.module.css";

const testimonials = [
  {
    name: "Laura Gómez",
    role: "Emprendedora",
    quote:
      "Gracias a las clases de Maximiliano pude armar mis primeras campañas en Meta Ads y duplicar las ventas de mi tienda en dos meses.",
    stars: 5,
  },
  {
    name: "Rodrigo Páez",
    role: "Community Manager",
    quote:
      "El curso de Google Ads me dio las herramientas que necesitaba para ofrecer un servicio completo a mis clientes. Lo recomiendo al 100%.",
    stars: 5,
  },
  {
    name: "Valentina Torres",
    role: "Dueña de comercio",
    quote:
      "Al principio tenía miedo de lo técnico, pero Maximiliano explica todo de forma muy clara. Ahora manejo mis propias campañas con confianza.",
    stars: 5,
  },
];

export default function Testimonials() {
  return (
    <section className={styles.testimonials}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Testimonios</span>
        <h2 className={styles.title}>Lo que dicen mis alumnos</h2>
        <div className={styles.grid}>
          {testimonials.map(({ name, role, quote, stars }) => (
            <div key={name} className={styles.card}>
              <div className={styles.stars}>
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} size={18} />
                ))}
              </div>
              <p className={styles.quote}>&ldquo;{quote}&rdquo;</p>
              <div className={styles.author}>
                <span className={styles.name}>{name}</span>
                <span className={styles.role}>{role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
