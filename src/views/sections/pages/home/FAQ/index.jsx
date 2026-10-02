"use client";

import { useState } from "react";
import styles from "./styles.module.css";

const faqs = [
  {
    question: "¿Cómo se reservan las clases?",
    answer:
      "Con tu cuenta, entrá a Próximas actividades y elegí una clase o un curso. Las clases gratuitas quedan confirmadas al instante; en los cursos tu lugar queda reservado hasta que se confirme el pago. Todo lo que tenés inscripto aparece en tu dashboard.",
  },
  {
    question: "¿Cuánto duran las sesiones?",
    answer:
      "Depende de cada actividad: la duración figura en cada clase, y en los cursos vas a ver la cantidad de clases y la duración total antes de inscribirte.",
  },
  {
    question: "¿Qué plataforma se usa para las clases online?",
    answer:
      "Todas las clases se realizan vía Google Meet. El link aparece en Mis clases, en tu dashboard, antes de cada sesión (en los cursos, una vez confirmado el pago).",
  },
  {
    question: "¿Necesito experiencia previa en publicidad digital?",
    answer:
      "No. Los cursos están diseñados para distintos niveles. En la primera sesión evaluamos tu punto de partida y adaptamos el contenido a tus necesidades.",
  },
  {
    question: "¿Cuáles son los métodos de pago?",
    answer:
      "Al inscribirte a un curso, en Mis cursos vas a ver las instrucciones de pago. El pago se coordina directamente con Maximiliano y, cuando se confirma, se habilitan los links, las grabaciones y los materiales.",
  },
  {
    question: "¿Hay materiales de apoyo?",
    answer:
      "Sí. Según el curso o clase, se comparten recursos, guías y ejercicios prácticos para que puedas repasar los contenidos y aplicarlos en tus propios proyectos.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className={styles.faq}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>FAQ</span>
        <h2 className={styles.title}>Preguntas frecuentes</h2>
        <div className={styles.list}>
          {faqs.map(({ question, answer }, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`${styles.item} ${isOpen ? styles.itemOpen : ""}`}
              >
                <button
                  className={styles.question}
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                >
                  <span>{question}</span>
                  <span
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div className={styles.answer}>
                    <p>{answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
