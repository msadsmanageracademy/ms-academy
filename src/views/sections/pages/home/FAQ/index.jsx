"use client";

import { useState } from "react";
import styles from "./styles.module.css";

const faqs = [
  {
    question: "¿Cómo se reservan las clases?",
    answer:
      "Una vez que creás tu cuenta en la plataforma, podés inscribirte a las clases disponibles desde tu dashboard personal. Recibirás una confirmación con el link de Google Meet.",
  },
  {
    question: "¿Cuánto duran las sesiones?",
    answer:
      "Las clases individuales tienen una duración de 60 minutos. Los cursos estructurados incluyen sesiones semanales de 90 minutos a lo largo de varias semanas.",
  },
  {
    question: "¿Qué plataforma se usa para las clases online?",
    answer:
      "Todas las clases se realizan vía Google Meet. El link se genera automáticamente y lo encontrás en tu dashboard personal antes de cada sesión.",
  },
  {
    question: "¿Necesito experiencia previa en publicidad digital?",
    answer:
      "No. Los cursos están diseñados para distintos niveles. En la primera sesión evaluamos tu punto de partida y adaptamos el contenido a tus necesidades.",
  },
  {
    question: "¿Cuáles son los métodos de pago?",
    answer:
      "Podés abonar por transferencia bancaria o mediante los métodos indicados al momento de confirmar tu inscripción. El pago se gestiona directamente con Maximiliano.",
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
