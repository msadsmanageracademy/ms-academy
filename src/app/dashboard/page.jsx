import PrimaryLink from "@/views/components/ui/PrimaryLink";
import { es } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { formatWeekdayDateTime } from "@/utils/dates";
import { getActor } from "@/lib/api/guards";
import { getDashboardSummary } from "./_lib/summary";
import { isAdminActor } from "@/server/errors";
import { redirect } from "next/navigation";
import styles from "./styles.module.css";
import { Clock, Courses, Money, NavbarClasses } from "@/views/components/icons";

export const metadata = { title: "Panel de control | MS Academy" };

const StatCard = ({ title, value, label }) => (
  <div className={styles.statCard}>
    <h3>{title}</h3>
    <div className={styles.value}>{value}</div>
    <div className={styles.label}>{label}</div>
  </div>
);

const fromNow = (date) => formatDistanceToNow(new Date(date), { locale: es });

const iconProps = { fill: "var(--color-4)", size: 28 };

function NextClassCard({ cls }) {
  return (
    <div className={styles.upcomingCard}>
      <div className={styles.upcomingBadge}>Próxima Clase ({fromNow(cls.start_date)})</div>
      <h3>{cls.title}</h3>
      <p className={styles.upcomingDate}>{formatWeekdayDateTime(cls.start_date)}</p>
      <p className={styles.upcomingDescription}>{cls.short_description}</p>
      <div className={styles.upcomingInfo}>
        {cls.courseTitle ? (
          <span>
            <Courses {...iconProps} /> {cls.courseTitle}
          </span>
        ) : (
          <span>
            <Money {...iconProps} /> {cls.price === 0 ? "Gratis" : `$${cls.price}`}
          </span>
        )}
        <span>
          <Clock {...iconProps} /> {cls.duration} min
        </span>
      </div>
    </div>
  );
}

function NextCourseCard({ course }) {
  return (
    <div className={styles.upcomingCard}>
      <div className={styles.upcomingBadge}>Próximo Curso ({fromNow(course.start_date)})</div>
      <h3>{course.title}</h3>
      <p className={styles.upcomingDate}>Inicia: {formatWeekdayDateTime(course.start_date)}</p>
      <p className={styles.upcomingDescription}>{course.short_description}</p>
      <div className={styles.upcomingInfo}>
        <span>
          <NavbarClasses {...iconProps} />
          {course.amount_of_classes} clases
        </span>
        <span>
          <Money {...iconProps} /> ${course.price}
        </span>
      </div>
    </div>
  );
}

// Server Component: no client JavaScript, the summary is computed with the services
export default async function DashboardPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const isAdmin = isAdminActor(actor);
  const { stats, nextClass, nextCourse } = await getDashboardSummary(actor);
  const userName = actor.name || actor.email.split("@")[0];

  return (
    <div className={styles.container}>
      <div className={styles.welcomeSection}>
        <h1>Panel de Control</h1>
        <h2>¡Bienvenido, {userName}!</h2>
        <p>Rol: {isAdmin ? "Administrador" : "Usuario"}</p>
      </div>

      <div className={styles.statsSection}>
        {isAdmin ? (
          <>
            <div className={styles.statsGroup}>
              <span className={styles.statsGroupLabel}>Clases</span>
              <div className={styles.statsGrid}>
                <StatCard title="En borrador" value={stats.draftClasses} label="No visibles aún" />
                <StatCard title="Asociadas" value={stats.enrolledClasses} label="Asignadas a un curso" />
                <StatCard title="Publicadas" value={stats.publishedClasses} label="Visibles en el sitio" />
              </div>
            </div>
            <div className={styles.statsGroup}>
              <span className={styles.statsGroupLabel}>Cursos</span>
              <div className={styles.statsGrid}>
                <StatCard title="En borrador" value={stats.draftCourses} label="No visibles aún" />
                <StatCard title="Publicados" value={stats.publishedCourses} label="Visibles en el sitio" />
              </div>
            </div>
          </>
        ) : (
          <div className={styles.statsGrid}>
            <StatCard title="Mis Clases" value={stats.classes} label="Clases inscritas" />
            <StatCard title="Pre-inscripciones" value={stats.preEnrolledCourses} label="Pago pendiente" />
            <StatCard title="Mis Cursos" value={stats.enrolledCourses} label="Cursos pagos" />
          </div>
        )}
      </div>

      <div className={styles.upcomingSection}>
        <h2>Próximas Actividades</h2>
        {!nextClass && !nextCourse ? (
          <p>No hay actividades publicadas próximas.</p>
        ) : (
          <div className={styles.upcomingGrid}>
            {nextClass && <NextClassCard cls={nextClass} />}
            {nextCourse && <NextCourseCard course={nextCourse} />}
          </div>
        )}
      </div>

      <div className={styles.quickActions}>
        <h2>Accesos Rápidos</h2>
        <div className={styles.actionsGrid}>
          <PrimaryLink dark className={styles.actionsGridLink} href="/dashboard/classes" text="Ver Clases" />
          <PrimaryLink dark className={styles.actionsGridLink} href="/dashboard/courses" text="Ver Cursos" />
          <PrimaryLink dark className={styles.actionsGridLink} href="/dashboard/account" text="Mi Cuenta" />
          {!isAdmin && <PrimaryLink dark href="/content" text="Próximas actividades" />}
        </div>
      </div>
    </div>
  );
}
