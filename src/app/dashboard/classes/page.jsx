"use client";

import ClassForm from "@/views/sections/pages/dashboard/classes/ClassForm";
import PageLoader from "@/views/components/layout/PageLoader";
import PrimaryLink from "@/views/components/ui/PrimaryLink";
import styles from "./styles.module.css";
import { useSession } from "next-auth/react";
import { Delete, Pencil } from "@/views/components/icons";
import { useEffect, useState } from "react";
import {
  confirmDelete,
  confirmUnenroll,
  toastError,
  toastSuccess,
} from "@/utils/alerts";

const ClassesPage = () => {
  const { data: session } = useSession();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClass, setEditingClass] = useState(null);

  useEffect(() => {
    if (session) {
      fetchClasses();
    }
  }, [session]);

  const handleDelete = async (id) => {
    const result = await confirmDelete(
      "¿Eliminar clase?",
      "Esta acción no se puede deshacer"
    );

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error deleting class");

      setClasses(classes.filter((c) => c._id !== id));
      toastSuccess(
        3000,
        "Clase eliminada",
        "La clase se eliminó correctamente"
      );
    } catch (err) {
      console.error("Error deleting class:", err);
      toastError(3000, "Error", "No se pudo eliminar la clase");
    }
  };

  const handleEdit = (classItem) => {
    setEditingClass(classItem);
    setShowCreateForm(false);
  };

  const handleUnenroll = async (classId) => {
    const result = await confirmUnenroll(
      "¿Cancelar inscripción?",
      "Se eliminará tu inscripción a esta clase"
    );

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(
        `/api/classes/sign-up/${classId}?userId=${session.user.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        return toastError(3000, "Error", data.message);
      }

      setClasses(classes.filter((c) => c._id !== classId));
      toastSuccess(
        3000,
        "Inscripción cancelada",
        "Tu inscripción se canceló correctamente"
      );
    } catch (err) {
      console.error("Error unenrolling from class:", err);
      toastError(3000, "Error", "No se pudo cancelar la inscripción");
    }
  };

  const handleCancelEdit = () => {
    setEditingClass(null);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingClass(null);
    // Refresh the list
    if (session) {
      fetchClasses();
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      if (!res.ok) throw new Error("Error fetching classes");

      const data = await res.json();

      // Filter classes based on user role
      if (session?.user?.role === "user") {
        const userClasses = data.data.filter((classItem) =>
          classItem.participants?.includes(session.user.id)
        );
        setClasses(userClasses);
      } else {
        setClasses(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className={styles.container}>
      <h1>
        {session?.user?.role === "admin" ? "Gestión de Clases" : "Mis Clases"}
      </h1>

      {session?.user?.role === "admin" ? (
        <>
          <div className={styles.listSection}>
            <h2>Todas las Clases</h2>
            {classes.length === 0 ? (
              <p className={styles.noClasses}>No hay clases disponibles</p>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Fecha</th>
                      <th>Duración</th>
                      <th>Precio</th>
                      <th>Participantes</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((classItem) => (
                      <tr key={classItem._id}>
                        <td>{classItem.title}</td>
                        <td>
                          {new Date(classItem.start_date).toLocaleString(
                            "es-AR"
                          )}
                        </td>
                        <td>{classItem.duration} min</td>
                        <td>
                          {classItem.price === 0
                            ? "Sin costo"
                            : `$${classItem.price}`}
                        </td>
                        <td>
                          {classItem.participants?.length || 0} /{" "}
                          {classItem.max_participants || "∞"}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button
                              onClick={() => handleEdit(classItem)}
                              className={styles.iconButton}
                              title="Editar"
                            >
                              <Pencil size={20} />
                            </button>
                            <button
                              onClick={() => handleDelete(classItem._id)}
                              className={styles.iconButtonDanger}
                              title="Eliminar"
                            >
                              <Delete size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PrimaryLink
              asButton
              text={showCreateForm ? "Cancelar" : "+ Nueva Clase"}
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setEditingClass(null);
              }}
            />
          </div>

          {showCreateForm && (
            <div className={styles.formSection}>
              <h2>Crear Nueva Clase</h2>
              <ClassForm onSuccess={handleFormSuccess} />
            </div>
          )}

          {editingClass && (
            <div className={styles.formSection}>
              <h2>Editar Clase</h2>
              <ClassForm
                classData={editingClass}
                onSuccess={handleFormSuccess}
                onCancel={handleCancelEdit}
              />
            </div>
          )}
        </>
      ) : (
        <div className={styles.listSection}>
          <h2>Clases Inscritas</h2>
          {classes.length === 0 ? (
            <div className={styles.noInscriptions}>
              <p>No estás inscrito en ninguna clase</p>
              <PrimaryLink href="/content" text="Ver próximas actividades" />
            </div>
          ) : (
            <div className={styles.classGrid}>
              {classes.map((classItem) => (
                <div key={classItem._id} className={styles.classCard}>
                  <h3>{classItem.title}</h3>
                  <p>{classItem.short_description}</p>
                  <p>
                    <strong>Fecha:</strong>{" "}
                    {new Date(classItem.start_date).toLocaleString("es-AR")}
                  </p>
                  <p>
                    <strong>Duración:</strong> {classItem.duration} minutos
                  </p>
                  <p>
                    <strong>Precio:</strong> $
                    {classItem.price === 0 ? "Sin costo" : classItem.price}
                  </p>
                  <div className={styles.actions}>
                    <PrimaryLink
                      asButton
                      danger
                      text={"Cancelar inscripción"}
                      onClick={() => handleUnenroll(classItem._id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClassesPage;
