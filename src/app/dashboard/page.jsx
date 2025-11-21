"use client";

import PageLoader from "@/views/components/layout/PageLoader";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const DashboardPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    classes: 0,
    courses: 0,
  });
  const [nextClass, setNextClass] = useState(null);
  const [nextCourse, setNextCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    const fetchStats = async () => {
      try {
        const [classesRes, coursesRes] = await Promise.all([
          fetch("/api/classes"),
          fetch("/api/courses"),
        ]);

        const classesData = await classesRes.json();
        const coursesData = await coursesRes.json();

        const now = new Date();

        if (session.user.role === "admin") {
          // For admins: show next class and course from all available
          const upcomingClasses = classesData.data?.filter(
            (c) => new Date(c.start_date) > now
          );
          if (upcomingClasses?.length > 0) {
            upcomingClasses.sort(
              (a, b) => new Date(a.start_date) - new Date(b.start_date)
            );
            setNextClass(upcomingClasses[0]);
          }

          const upcomingCourses = coursesData.data?.filter(
            (c) => new Date(c.start_date) > now
          );
          if (upcomingCourses?.length > 0) {
            upcomingCourses.sort(
              (a, b) => new Date(a.start_date) - new Date(b.start_date)
            );
            setNextCourse(upcomingCourses[0]);
          }

          setStats({
            classes: classesData.data?.length || 0,
            courses: coursesData.data?.length || 0,
          });
        } else {
          const userClasses = classesData.data?.filter((c) =>
            c.participants?.includes(session.user.id)
          );
          const userCourses = coursesData.data?.filter((c) =>
            c.participants?.includes(session.user.id)
          );

          // Find next upcoming class for enrolled users
          const now = new Date();
          const upcomingClasses = userClasses?.filter(
            (c) => new Date(c.start_date) > now
          );
          if (upcomingClasses?.length > 0) {
            upcomingClasses.sort(
              (a, b) => new Date(a.start_date) - new Date(b.start_date)
            );
            setNextClass(upcomingClasses[0]);
          }

          // Find next upcoming course for enrolled users
          const upcomingCourses = userCourses?.filter(
            (c) => new Date(c.start_date) > now
          );
          if (upcomingCourses?.length > 0) {
            upcomingCourses.sort(
              (a, b) => new Date(a.start_date) - new Date(b.start_date)
            );
            setNextCourse(upcomingCourses[0]);
          }

          setStats({
            classes: userClasses?.length || 0,
            courses: userCourses?.length || 0,
          });
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [status, session, router]);

  if (status === "loading" || loading) {
    return <PageLoader />;
  }

  if (session) {
    const isAdmin = session.user.role === "admin";
    const userName = session.user.name || session.user.email.split("@")[0];

    return (
      <div className={styles.container}>
        <div className={styles.welcomeSection}>
          <h1>Panel de Control</h1>
          <h2>¡Bienvenido, {userName}!</h2>
          <p>Rol: {isAdmin ? "Administrador" : "Usuario"}</p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3>{isAdmin ? "Total Clases" : "Mis Clases"}</h3>
            <div className={styles.value}>{stats.classes}</div>
            <div className={styles.label}>
              {isAdmin ? "Clases creadas" : "Clases inscritas"}
            </div>
          </div>

          <div className={styles.statCard}>
            <h3>{isAdmin ? "Total Cursos" : "Mis Cursos"}</h3>
            <div className={styles.value}>{stats.courses}</div>
            <div className={styles.label}>
              {isAdmin ? "Cursos creados" : "Cursos inscritos"}
            </div>
          </div>
        </div>

        {(nextClass || nextCourse) && (
          <div className={styles.upcomingSection}>
            <h2>Próximas Actividades</h2>
            <div className={styles.upcomingGrid}>
              {nextClass && (
                <div className={styles.upcomingCard}>
                  <div className={styles.upcomingBadge}>Próxima Clase</div>
                  <h3>{nextClass.title}</h3>
                  <p className={styles.upcomingDate}>
                    {new Date(nextClass.start_date).toLocaleString("es-AR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className={styles.upcomingDescription}>
                    {nextClass.short_description}
                  </p>
                  <div className={styles.upcomingInfo}>
                    <span>⏱️ {nextClass.duration} min</span>
                    {nextClass.price === 0 ? (
                      <span>🆓 Gratis</span>
                    ) : (
                      <span>💵 ${nextClass.price}</span>
                    )}
                  </div>
                </div>
              )}

              {nextCourse && (
                <div className={styles.upcomingCard}>
                  <div className={styles.upcomingBadge}>Próximo Curso</div>
                  <h3>{nextCourse.title}</h3>
                  <p className={styles.upcomingDate}>
                    Inicia:{" "}
                    {new Date(nextCourse.start_date).toLocaleString("es-AR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className={styles.upcomingDescription}>
                    {nextCourse.short_description}
                  </p>
                  <div className={styles.upcomingInfo}>
                    <span>📚 {nextCourse.amount_of_classes} clases</span>
                    <span>💵 ${nextCourse.price}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.quickActions}>
          <h2>Accesos Rápidos</h2>
          <div className={styles.actionsGrid}>
            <PrimaryLink href="/dashboard/classes" text="Ver Clases" />
            <PrimaryLink href="/dashboard/courses" text="Ver Cursos" />
            <PrimaryLink href="/dashboard/account" text="Mi Cuenta" />
            {!isAdmin && (
              <PrimaryLink href="/content" text="Próximas actividades" />
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default DashboardPage;
