import ClassRow from "./ClassRow";
import CourseCard from "./CourseCard";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "../styles.module.css";

// Caps the entrance delay so long lists don't wait for their last items
const MAX_STAGGER = 8;

const countLabel = (n, singular, plural) => (n === 1 ? `1 ${singular}` : `${n} ${plural}`);

/** Public catalog: header band, open courses grid and the free classes agenda. */
const ContentView = ({ classes, courses, viewerRole }) => {
  const counters = [
    courses.length ? countLabel(courses.length, "curso", "cursos") : null,
    classes.length ? countLabel(classes.length, "clase", "clases") : null,
  ].filter(Boolean);
  const isEmpty = !courses.length && !classes.length;

  return (
    <div className={styles.page}>
      <section aria-labelledby="content-title" className={`${styles.header} dark-surface`}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Agenda</p>
          <h1 className={styles.title} id="content-title">
            Próximas actividades
          </h1>
          <p className={styles.subtitle}>
            Clases gratuitas para dar tus primeros pasos y cursos completos para profundizar.
          </p>
          {counters.length ? <p className={styles.counters}>{counters.join(" · ")}</p> : null}
        </div>
      </section>

      {isEmpty ? (
        <section aria-labelledby="content-empty-title" className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.empty}>
              <h2 className={styles.sectionTitle} id="content-empty-title">
                Por ahora no hay actividades programadas
              </h2>
              <p className={styles.emptyText}>Estoy preparando nuevas clases y cursos.</p>
              <PrimaryLink
                dark
                href="/contact"
                text="Escribime para enterarte de las próximas fechas"
              />
            </div>
          </div>
        </section>
      ) : null}

      {courses.length ? (
        <section aria-labelledby="courses-title" className={styles.section}>
          <div className={styles.sectionInner}>
            <h2 className={styles.sectionTitle} id="courses-title">
              Cursos
            </h2>
            <ul className={styles.grid}>
              {courses.map((course, i) => (
                <li
                  key={course._id}
                  className={styles.animated}
                  style={{ "--stagger": Math.min(i, MAX_STAGGER) }}
                >
                  <CourseCard course={course} viewerRole={viewerRole} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {classes.length ? (
        <section
          aria-labelledby="classes-title"
          className={`${styles.section} ${courses.length ? styles.sectionFollow : ""}`}
        >
          <div className={styles.sectionInner}>
            <h2 className={styles.sectionTitle} id="classes-title">
              Clases gratuitas
            </h2>
            <ul className={styles.agenda}>
              {classes.map((classItem, i) => (
                <li
                  key={classItem._id}
                  className={styles.animated}
                  style={{ "--stagger": Math.min(i, MAX_STAGGER) }}
                >
                  <ClassRow classItem={classItem} viewerRole={viewerRole} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default ContentView;
