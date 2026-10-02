"use client";

import ClassForm from "@/views/sections/pages/dashboard/classes/ClassForm";
import ClassInfoSection from "./ClassInfoSection";
import IconLink from "@/views/components/ui/IconLink";
import ParticipantsSection from "./ParticipantsSection";
import RecordingSection from "./RecordingSection";
import ResourcesSection from "./ResourcesSection";
import styles from "../styles.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReviewList, { ReviewSummary } from "@/views/components/ui/ReviewList";
import { getClassStatus, getCourseTimeStatus } from "@/utils/classStatus";

/** Admin class detail. Data comes from the server; actions re-render it. */
const ClassDetailView = ({ classData, course, participants, reviews, hasCalendarAccess }) => {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const completed =
    getClassStatus(classData.start_date, classData.duration, classData.status) === "completed";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Detalles de la Clase</h1>
        <IconLink
          asButton={editMode}
          fill="var(--color-4)"
          href={editMode ? undefined : "/dashboard/classes"}
          icon="Back"
          onClick={editMode ? () => setEditMode(false) : undefined}
          title="Volver"
        />
      </div>

      {editMode ? (
        <section className={styles.section}>
          <h2 className={styles.formTitle}>Editar Clase</h2>
          <ClassForm
            classData={classData}
            hasCalendarAccess={hasCalendarAccess}
            onCancel={() => setEditMode(false)}
            onSuccess={() => {
              setEditMode(false);
              router.refresh();
            }}
            // Classes of a course in progress only accept title and description
            allowFullEdit={
              classData.status === "enrolled" &&
              getCourseTimeStatus(course?.start_date, course?.end_date, course?.status) !==
                "in-progress"
            }
          />
        </section>
      ) : (
        <>
          <ClassInfoSection
            classData={classData}
            courseTitle={course?.title ?? null}
            onEdit={() => setEditMode(true)}
          />

          {classData.courseId && (
            <>
              <ResourcesSection classId={classData._id} initialResources={classData.resources || []} />
              <RecordingSection classId={classData._id} currentUrl={classData.recording_url} />
            </>
          )}

          {classData.status !== "enrolled" && (
            <ParticipantsSection classData={classData} participants={participants} />
          )}

          {completed && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>
                  Reseñas
                  <ReviewSummary avgRating={classData.avgRating} reviewCount={classData.reviewCount} />
                </h2>
              </div>
              <ReviewList reviews={reviews} emptyText="Todavía no hay reseñas para esta clase." />
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ClassDetailView;
