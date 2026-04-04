import {
  ClassFormSchema,
  PublishedClassEditSchema,
  ClassResourcesUpdateSchema,
} from "@/utils/validation";
import { ObjectId } from "mongodb";
import {
  addTimestampToUpdate,
  prepareNotificationForDB,
} from "@/models/schemas";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { google } from "googleapis";
import { getClassStatus, getCourseTimeStatus } from "@/utils/classStatus";

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const classItem = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!classItem) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 },
      );
    }

    // If class belongs to a course, attach payment status and strip Google links if unpaid
    const session = await auth();
    if (classItem.courseId && session?.user?.id) {
      const enrollment = await db.collection("courseEnrollments").findOne(
        {
          userId: new ObjectId(session.user.id),
          courseId: classItem.courseId,
        },
        { projection: { paymentStatus: 1 } },
      );
      classItem.userCoursePaymentStatus = enrollment?.paymentStatus ?? null;

      if (
        session.user.role !== "admin" &&
        classItem.userCoursePaymentStatus !== "paid"
      ) {
        delete classItem.googleEventId;
        delete classItem.googleMeetLink;
        delete classItem.calendarEventLink;
        delete classItem.recording_url;
        delete classItem.resources;
      }
    }

    // Attach review stats
    const reviewStats = await db
      .collection("reviews")
      .aggregate([
        { $match: { classId: new ObjectId(id) } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const rStats = reviewStats[0] ?? { avgRating: null, reviewCount: 0 };
    classItem.avgRating = rStats.avgRating
      ? Math.round(rStats.avgRating * 10) / 10
      : null;
    classItem.reviewCount = rStats.reviewCount;

    if (session?.user?.id) {
      classItem.userReview =
        (await db.collection("reviews").findOne({
          classId: new ObjectId(id),
          userId: new ObjectId(session.user.id),
        })) ?? null;
    }

    return Response.json(
      {
        success: true,
        data: classItem,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al obtener la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 },
      );

    // Status-only toggle â€” skip full form validation
    if (Object.keys(body).length === 1 && "status" in body) {
      if (!["draft", "published"].includes(body.status)) {
        return Response.json(
          { success: false, message: "Estado inválido" },
          { status: 400 },
        );
      }
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      const classToToggle = await db.collection("classes").findOne(
        { _id: new ObjectId(id) },
        {
          projection: {
            status: 1,
            participants: 1,
            title: 1,
            createdBy: 1,
            start_date: 1,
            duration: 1,
          },
        },
      );
      if (!classToToggle) {
        return Response.json(
          { success: false, message: "Clase no encontrada" },
          { status: 404 },
        );
      }
      if (classToToggle.status === "enrolled") {
        return Response.json(
          {
            success: false,
            message:
              "No se puede cambiar el estado de una clase asignada a un curso",
          },
          { status: 400 },
        );
      }

      if (body.status === "published") {
        if (!classToToggle.start_date) {
          return Response.json(
            {
              success: false,
              message:
                "No se puede publicar una clase sin fecha de inicio asignada",
            },
            { status: 400 },
          );
        }
        if (new Date(classToToggle.start_date) < new Date()) {
          return Response.json(
            {
              success: false,
              message:
                "No se puede publicar una clase cuya fecha de inicio ya pasó",
            },
            { status: 400 },
          );
        }
      }

      if (body.status === "draft") {
        const temporal = getClassStatus(
          classToToggle.start_date,
          classToToggle.duration,
          classToToggle.status,
        );
        if (temporal === "ongoing") {
          return Response.json(
            {
              success: false,
              message:
                "No se puede archivar una clase que está en curso en este momento",
            },
            { status: 400 },
          );
        }
      }

      const revertingToDraft =
        body.status === "draft" && classToToggle.participants?.length > 0;

      const updateOp = revertingToDraft
        ? { $set: { status: "draft", participants: [], updatedAt: new Date() } }
        : { $set: { status: body.status, updatedAt: new Date() } };

      const result = await db
        .collection("classes")
        .updateOne({ _id: new ObjectId(id) }, updateOp);
      if (result.matchedCount === 0) {
        return Response.json(
          { success: false, message: "Clase no encontrada" },
          { status: 404 },
        );
      }

      // Build notifications
      const notificationsToCreate = [];

      // Notify removed participants
      if (revertingToDraft) {
        for (const participantId of classToToggle.participants) {
          notificationsToCreate.push(
            prepareNotificationForDB({
              userId: participantId,
              type: "class.removed_by_admin",
              title: "Suscripción anulada",
              message: `Has sido dado de baja de la clase "${classToToggle.title}" porque fue archivada por un administrador`,
              relatedId: new ObjectId(id),
              relatedType: "class",
            }),
          );
        }
      }

      // Notify admin about status change
      if (classToToggle.createdBy) {
        const statusLabel =
          body.status === "published" ? "publicada" : "archivada";
        notificationsToCreate.push(
          prepareNotificationForDB({
            userId: classToToggle.createdBy,
            type: "class.status_changed",
            title: "Estado de clase actualizado",
            message: `La clase "${classToToggle.title}" fue ${statusLabel}`,
            relatedId: new ObjectId(id),
            relatedType: "class",
            actorId: classToToggle.createdBy,
          }),
        );
      }

      if (notificationsToCreate.length > 0) {
        await db.collection("notifications").insertMany(notificationsToCreate);
      }
      const updatedClass = await db
        .collection("classes")
        .findOne(
          { _id: new ObjectId(id) },
          { projection: { status: 1, participants: 1 } },
        );
      return Response.json(
        { success: true, message: "Estado actualizado", data: updatedClass },
        { status: 200 },
      );
    }

    // courseId-only update — skip full form validation
    if (Object.keys(body).length === 1 && "courseId" in body) {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      const classesCollection = db.collection("classes");
      const coursesCollection = db.collection("courses");

      const existingClass = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!existingClass) {
        return Response.json(
          { success: false, message: "Clase no encontrada" },
          { status: 404 },
        );
      }

      const courseIdRaw = body.courseId;
      const isRemoving = courseIdRaw === null || courseIdRaw === "";
      const isAssigning = courseIdRaw && ObjectId.isValid(courseIdRaw);

      if (isAssigning && existingClass.status === "published") {
        return Response.json(
          {
            success: false,
            message: "No se puede vincular una clase publicada a un curso",
          },
          { status: 400 },
        );
      }

      if (!isRemoving && !isAssigning) {
        return Response.json(
          { success: false, message: "courseId inválido" },
          { status: 400 },
        );
      }

      const updateOp = isRemoving
        ? {
            $set: { status: "draft", updatedAt: new Date() },
            $unset: { courseId: "" },
          }
        : {
            $set: {
              courseId: new ObjectId(courseIdRaw),
              status: "enrolled",
              max_participants: null,
              updatedAt: new Date(),
            },
          };

      await classesCollection.updateOne({ _id: new ObjectId(id) }, updateOp);

      const notificationsToCreate = [];

      if (isAssigning && existingClass.createdBy) {
        const assignedCourse = await coursesCollection.findOne(
          { _id: new ObjectId(courseIdRaw) },
          { projection: { title: 1, status: 1 } },
        );
        const courseTitle = assignedCourse?.title || "";

        // If course is published, add all paid enrollees to the class
        let courseParticipantIds = [];
        if (assignedCourse?.status === "published") {
          const paidEnrollments = await db
            .collection("courseEnrollments")
            .find(
              { courseId: new ObjectId(courseIdRaw) },
              { projection: { userId: 1 } },
            )
            .toArray();
          courseParticipantIds = paidEnrollments.map((e) => e.userId);
          if (courseParticipantIds.length > 0) {
            await classesCollection.updateOne(
              { _id: new ObjectId(id) },
              { $addToSet: { participants: { $each: courseParticipantIds } } },
            );
          }
        }

        // If the course was published but is now temporally completed (all existing
        // classes have ended), adding a new future class invalidates that "completed"
        // state — revert the course to draft so the admin can republish intentionally.
        if (assignedCourse?.status === "published") {
          const dateStats = await classesCollection
            .aggregate([
              {
                $match: {
                  courseId: new ObjectId(courseIdRaw),
                  _id: { $ne: new ObjectId(id) },
                },
              },
              {
                $group: {
                  _id: null,
                  start_date: { $min: "$start_date" },
                  end_date: {
                    $max: {
                      $add: [
                        "$start_date",
                        { $multiply: ["$duration", 60000] },
                      ],
                    },
                  },
                },
              },
            ])
            .toArray();
          const { start_date: cs, end_date: ce } = dateStats[0] ?? {};
          if (getCourseTimeStatus(cs, ce, "published") === "completed") {
            await coursesCollection.updateOne(
              { _id: new ObjectId(courseIdRaw) },
              { $set: { status: "draft", updatedAt: new Date() } },
            );
          }
        }
        notificationsToCreate.push(
          prepareNotificationForDB({
            userId: existingClass.createdBy,
            type: "class.status_changed",
            title: "Clase asignada a curso",
            message: `La clase "${existingClass.title}" fue asignada al curso "${courseTitle}"`,
            relatedId: new ObjectId(id),
            relatedType: "class",
            actorId: existingClass.createdBy,
          }),
        );
        courseParticipantIds.forEach((participantId) => {
          notificationsToCreate.push(
            prepareNotificationForDB({
              userId: participantId,
              type: "class.added_to_course",
              title: "Nueva clase en tu curso",
              message: `Se agregó la clase "${existingClass.title}" al curso "${courseTitle}"`,
              relatedId: new ObjectId(id),
              relatedType: "class",
              actorId: existingClass.createdBy,
            }),
          );
        });
      } else if (
        isRemoving &&
        existingClass.courseId &&
        existingClass.createdBy
      ) {
        const removedCourse = await coursesCollection.findOne(
          { _id: existingClass.courseId },
          { projection: { title: 1, status: 1 } },
        );
        const courseTitle = removedCourse?.title || "";

        // Remove enrolled participants from the class
        const paidEnrollmentsToRemove = await db
          .collection("courseEnrollments")
          .find(
            { courseId: existingClass.courseId },
            { projection: { userId: 1 } },
          )
          .toArray();
        const removedParticipantIds = paidEnrollmentsToRemove.map(
          (e) => e.userId,
        );
        if (removedParticipantIds.length > 0) {
          await classesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $pull: { participants: { $in: removedParticipantIds } } },
          );
        }

        notificationsToCreate.push(
          prepareNotificationForDB({
            userId: existingClass.createdBy,
            type: "class.status_changed",
            title: "Clase removida de curso",
            message: `La clase "${existingClass.title}" fue eliminada del curso "${courseTitle}"`,
            relatedId: new ObjectId(id),
            relatedType: "class",
            actorId: existingClass.createdBy,
          }),
        );
        removedParticipantIds.forEach((participantId) => {
          notificationsToCreate.push(
            prepareNotificationForDB({
              userId: participantId,
              type: "class.removed_from_course",
              title: "Clase removida de tu curso",
              message: `La clase "${existingClass.title}" fue eliminada del curso "${courseTitle}"`,
              relatedId: new ObjectId(id),
              relatedType: "class",
              actorId: existingClass.createdBy,
            }),
          );
        });
      }

      if (notificationsToCreate.length > 0) {
        await db.collection("notifications").insertMany(notificationsToCreate);
      }

      // If the course is now left with no classes and was published, revert it to draft
      if (isRemoving && existingClass.courseId) {
        const remainingClasses = await classesCollection.countDocuments({
          courseId: existingClass.courseId,
        });
        if (remainingClasses === 0) {
          const formerCourse = await coursesCollection.findOne(
            { _id: existingClass.courseId },
            { projection: { status: 1 } },
          );
          if (formerCourse?.status === "published") {
            await coursesCollection.updateOne(
              { _id: existingClass.courseId },
              { $set: { status: "draft", updatedAt: new Date() } },
            );
          }
        }
      }

      const updatedClass = await classesCollection.findOne(
        { _id: new ObjectId(id) },
        {
          projection: {
            courseId: 1,
            status: 1,
            participants: 1,
            max_participants: 1,
          },
        },
      );

      return Response.json(
        { success: true, message: "Curso actualizado", data: updatedClass },
        { status: 200 },
      );
    }

    // recording_url update — sets or clears the recording link for course-linked classes
    if ("recording_url" in body && Object.keys(body).length <= 2) {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      const classesCollection = db.collection("classes");

      const classForRecording = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!classForRecording) {
        return Response.json(
          { success: false, message: "Clase no encontrada" },
          { status: 404 },
        );
      }
      if (!classForRecording.courseId) {
        return Response.json(
          {
            success: false,
            message: "Solo se pueden agregar grabaciones a clases de un curso",
          },
          { status: 400 },
        );
      }

      const recordingUrl = body.recording_url;
      if (
        recordingUrl !== null &&
        recordingUrl !== undefined &&
        recordingUrl !== ""
      ) {
        try {
          new URL(recordingUrl);
        } catch {
          return Response.json(
            { success: false, message: "URL de grabación inválida" },
            { status: 400 },
          );
        }
      }

      const updateOp = recordingUrl
        ? { $set: { recording_url: recordingUrl, updatedAt: new Date() } }
        : { $unset: { recording_url: "" }, $set: { updatedAt: new Date() } };

      await classesCollection.updateOne({ _id: new ObjectId(id) }, updateOp);

      // Notify paid-enrolled participants when a recording is added
      if (recordingUrl && classForRecording.participants?.length > 0) {
        const enrollmentsCollection = db.collection("courseEnrollments");
        const paidEnrollments = await enrollmentsCollection
          .find(
            {
              courseId: classForRecording.courseId,
              paymentStatus: "paid",
            },
            { projection: { userId: 1 } },
          )
          .toArray();

        const paidUserIds = new Set(
          paidEnrollments.map((e) => e.userId.toString()),
        );

        const notificationsToCreate = classForRecording.participants
          .filter((pId) => paidUserIds.has(pId.toString()))
          .map((participantId) =>
            prepareNotificationForDB({
              userId: participantId,
              type: "class.recording_added",
              title: "Grabación disponible",
              message: `La grabación de la clase "${classForRecording.title}" ya está disponible`,
              relatedId: new ObjectId(id),
              relatedType: "class",
              actorId: classForRecording.createdBy,
            }),
          );

        if (notificationsToCreate.length > 0) {
          await db
            .collection("notifications")
            .insertMany(notificationsToCreate);
        }
      }

      return Response.json(
        {
          success: true,
          message: recordingUrl ? "Grabación guardada" : "Grabación eliminada",
        },
        { status: 200 },
      );
    }

    // resources update — sets the resources array for course-linked classes
    if ("resources" in body && Object.keys(body).length <= 2) {
      const parsed = ClassResourcesUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          {
            success: false,
            message: parsed.error.errors[0]?.message || "Datos inválidos",
          },
          { status: 400 },
        );
      }

      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      const classesCollection = db.collection("classes");

      const classForResources = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!classForResources) {
        return Response.json(
          { success: false, message: "Clase no encontrada" },
          { status: 404 },
        );
      }
      if (!classForResources.courseId) {
        return Response.json(
          {
            success: false,
            message: "Solo se pueden agregar materiales a clases de un curso",
          },
          { status: 400 },
        );
      }

      await classesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { resources: parsed.data.resources, updatedAt: new Date() } },
      );

      // Notify paid-enrolled participants when resources are updated
      if (
        parsed.data.resources.length > 0 &&
        classForResources.participants?.length > 0
      ) {
        const enrollmentsCollection = db.collection("courseEnrollments");
        const paidEnrollments = await enrollmentsCollection
          .find(
            { courseId: classForResources.courseId, paymentStatus: "paid" },
            { projection: { userId: 1 } },
          )
          .toArray();

        const paidUserIds = new Set(
          paidEnrollments.map((e) => e.userId.toString()),
        );

        const notificationsToCreate = classForResources.participants
          .filter((pId) => paidUserIds.has(pId.toString()))
          .map((participantId) =>
            prepareNotificationForDB({
              userId: participantId,
              type: "class.resources_updated",
              title: "Materiales actualizados",
              message: `Los materiales de la clase "${classForResources.title}" han sido actualizados`,
              relatedId: new ObjectId(id),
              relatedType: "class",
              actorId: classForResources.createdBy,
            }),
          );

        if (notificationsToCreate.length > 0) {
          await db
            .collection("notifications")
            .insertMany(notificationsToCreate);
        }
      }

      return Response.json(
        { success: true, message: "Materiales actualizados" },
        { status: 200 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");
    const usersCollection = db.collection("users");
    const coursesCollection = db.collection("courses");

    // Get the existing class to check status restrictions, calendar event, and current courseId
    const existingClass = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingClass) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 },
      );
    }

    // Published/enrolled classes: only title and short_description are editable
    // Exception: enrolled classes whose course is draft or has completed may be fully edited
    let isRestricted =
      existingClass.status === "published" ||
      existingClass.status === "enrolled";

    if (
      isRestricted &&
      existingClass.status === "enrolled" &&
      existingClass.courseId
    ) {
      const linkedCourse = await coursesCollection.findOne(
        { _id: existingClass.courseId },
        { projection: { status: 1 } },
      );
      if (linkedCourse) {
        const courseClasses = await db
          .collection("classes")
          .aggregate([
            { $match: { courseId: existingClass.courseId } },
            {
              $group: {
                _id: null,
                start_date: { $min: "$start_date" },
                end_date: {
                  $max: {
                    $add: ["$start_date", { $multiply: ["$duration", 60000] }],
                  },
                },
              },
            },
          ])
          .toArray();
        const { start_date: cs, end_date: ce } = courseClasses[0] ?? {};
        const courseTimeStatus = getCourseTimeStatus(
          cs,
          ce,
          linkedCourse.status,
        );
        // Restrict only while the course is actively in-progress
        if (courseTimeStatus !== "in-progress") isRestricted = false;
      }
    }

    if (isRestricted) {
      const parsedBody = PublishedClassEditSchema.safeParse(body);
      if (!parsedBody.success) {
        return Response.json(
          {
            success: false,
            message: "El formato de los datos es inválido",
            details: parsedBody.error.errors,
          },
          { status: 400 },
        );
      }
      await classesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: addTimestampToUpdate(parsedBody.data) },
      );
      if (existingClass.participants?.length > 0) {
        const notificationsToCreate = existingClass.participants.map(
          (participantId) =>
            prepareNotificationForDB({
              userId: participantId,
              type: "class.updated",
              title: "Clase actualizada",
              message: `La clase "${parsedBody.data.title || existingClass.title}" ha sido actualizada`,
              relatedId: new ObjectId(id),
              relatedType: "class",
              actorId: existingClass.createdBy,
            }),
        );
        await db.collection("notifications").insertMany(notificationsToCreate);
      }
      return Response.json(
        { success: true, message: "Clase actualizada con éxito" },
        { status: 200 },
      );
    }

    if (body.start_date) body.start_date = new Date(body.start_date);
    if (body.end_date) body.end_date = new Date(body.end_date);

    const parsedBody = ClassFormSchema.safeParse(body);

    if (!parsedBody.success) {
      return Response.json(
        {
          success: false,
          message: "El formato de los datos es inválido",
          details: parsedBody.error.errors,
        },
        { status: 400 },
      );
    }

    // Separate courseId from the rest of the body before building update
    const { courseId: courseIdRaw, ...bodyWithoutCourseId } = body;

    const setData = addTimestampToUpdate({
      ...bodyWithoutCourseId,
      max_participants:
        bodyWithoutCourseId.max_participants === 0
          ? null
          : bodyWithoutCourseId.max_participants,
    });

    const updateOp = { $set: setData };

    // Handle courseId assignment / unassignment
    const isRemovingCourse =
      "courseId" in body && (courseIdRaw === null || courseIdRaw === "");
    const isAssigningCourse = courseIdRaw && ObjectId.isValid(courseIdRaw);

    if (isRemovingCourse) {
      updateOp.$unset = { courseId: "" };
      setData.status = "draft";
    } else if (isAssigningCourse) {
      setData.courseId = new ObjectId(courseIdRaw);
      setData.status = "enrolled";
    }

    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      updateOp,
    );

    if (result.matchedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 },
      );
    }

    // If a class was removed from a published course, check if it's now empty and revert to draft
    if (isRemovingCourse && existingClass.courseId) {
      const remainingClasses = await classesCollection.countDocuments({
        courseId: existingClass.courseId,
      });
      if (remainingClasses === 0) {
        const formerCourse = await coursesCollection.findOne({
          _id: existingClass.courseId,
        });
        if (formerCourse?.status === "published") {
          await coursesCollection.updateOne(
            { _id: existingClass.courseId },
            { $set: { status: "draft", updatedAt: new Date() } },
          );
        }
      }
    }

    // Create notifications
    const notifications = db.collection("notifications");
    const notificationsToCreate = [];
    const classTitle = bodyWithoutCourseId.title || existingClass.title;

    if (isAssigningCourse) {
      // Admin notification: class assigned to course
      if (existingClass.createdBy) {
        const assignedCourse = await coursesCollection.findOne(
          { _id: new ObjectId(courseIdRaw) },
          { projection: { title: 1, participants: 1 } },
        );
        const courseTitle = assignedCourse?.title || "";
        notificationsToCreate.push(
          prepareNotificationForDB({
            userId: existingClass.createdBy,
            type: "class.status_changed",
            title: "Clase asignada a curso",
            message: `La clase "${classTitle}" fue asignada al curso "${courseTitle}"`,
            relatedId: new ObjectId(id),
            relatedType: "class",
            actorId: existingClass.createdBy,
          }),
        );
        // Notify course participants
        if (assignedCourse?.participants?.length > 0) {
          assignedCourse.participants.forEach((participantId) => {
            notificationsToCreate.push(
              prepareNotificationForDB({
                userId: participantId,
                type: "class.added_to_course",
                title: "Nueva clase en tu curso",
                message: `Se agregó la clase "${classTitle}" al curso "${courseTitle}"`,
                relatedId: new ObjectId(id),
                relatedType: "class",
                actorId: existingClass.createdBy,
              }),
            );
          });
        }
      }
    } else if (isRemovingCourse && existingClass.courseId) {
      // Admin notification: class removed from course
      if (existingClass.createdBy) {
        const removedCourse = await coursesCollection.findOne(
          { _id: existingClass.courseId },
          { projection: { title: 1, participants: 1 } },
        );
        const courseTitle = removedCourse?.title || "";
        notificationsToCreate.push(
          prepareNotificationForDB({
            userId: existingClass.createdBy,
            type: "class.status_changed",
            title: "Clase removida de curso",
            message: `La clase "${classTitle}" fue eliminada del curso "${courseTitle}"`,
            relatedId: new ObjectId(id),
            relatedType: "class",
            actorId: existingClass.createdBy,
          }),
        );
        // Notify former course participants
        if (removedCourse?.participants?.length > 0) {
          removedCourse.participants.forEach((participantId) => {
            notificationsToCreate.push(
              prepareNotificationForDB({
                userId: participantId,
                type: "class.removed_from_course",
                title: "Clase removida de tu curso",
                message: `La clase "${classTitle}" fue eliminada del curso "${courseTitle}"`,
                relatedId: new ObjectId(id),
                relatedType: "class",
                actorId: existingClass.createdBy,
              }),
            );
          });
        }
      }
    }

    if (notificationsToCreate.length > 0) {
      await notifications.insertMany(notificationsToCreate);
    }

    // If class has a Google Calendar event, update it only if relevant fields changed
    const relevantFieldsChanged =
      (bodyWithoutCourseId.title &&
        bodyWithoutCourseId.title !== existingClass.title) ||
      (bodyWithoutCourseId.short_description &&
        bodyWithoutCourseId.short_description !==
          existingClass.short_description) ||
      (bodyWithoutCourseId.start_date &&
        new Date(bodyWithoutCourseId.start_date).getTime() !==
          new Date(existingClass.start_date).getTime()) ||
      (bodyWithoutCourseId.duration &&
        bodyWithoutCourseId.duration !== existingClass.duration);

    if (
      existingClass.googleEventId &&
      existingClass.createdBy &&
      relevantFieldsChanged
    ) {
      try {
        // Get the admin user who created the event
        const adminUser = await usersCollection.findOne({
          _id: new ObjectId(existingClass.createdBy),
        });

        if (adminUser?.googleCalendarTokens) {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`,
          );

          oauth2Client.setCredentials(adminUser.googleCalendarTokens);

          const calendar = google.calendar({
            version: "v3",
            auth: oauth2Client,
          });

          // Calculate end time (start time + duration in minutes)
          const startDate = new Date(
            bodyWithoutCourseId.start_date || existingClass.start_date,
          );
          const endDate = new Date(startDate);
          const duration =
            bodyWithoutCourseId.duration || existingClass.duration;
          endDate.setMinutes(endDate.getMinutes() + duration);

          // Update the event in Google Calendar
          await calendar.events.patch({
            calendarId: "primary",
            eventId: existingClass.googleEventId,
            resource: {
              summary: bodyWithoutCourseId.title || existingClass.title,
              description:
                bodyWithoutCourseId.short_description ||
                existingClass.short_description ||
                "",
              start: {
                dateTime: startDate.toISOString(),
                timeZone: "America/Argentina/Buenos_Aires",
              },
              end: {
                dateTime: endDate.toISOString(),
                timeZone: "America/Argentina/Buenos_Aires",
              },
            },
          });

          console.log(
            `Updated Google Calendar event: ${existingClass.googleEventId}`,
          );
        }
      } catch (calendarError) {
        console.error("Error updating calendar event:", calendarError);
        // Continue even if calendar update fails
      }
    }

    return Response.json(
      {
        success: true,
        message: "Clase actualizada con éxito",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al actualizar la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");
    const usersCollection = db.collection("users");

    // Get the class to check if it has a calendar event
    const classItem = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!classItem) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 },
      );
    }

    if (classItem.status !== "draft") {
      return Response.json(
        {
          success: false,
          message: "Solo se pueden eliminar clases en estado archivado",
        },
        { status: 400 },
      );
    }

    // If class has a Google Calendar event, delete it
    if (classItem.googleEventId && classItem.createdBy) {
      try {
        // Get the admin user who created the event
        const adminUser = await usersCollection.findOne({
          _id: new ObjectId(classItem.createdBy),
        });

        if (adminUser?.googleCalendarTokens) {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`,
          );

          oauth2Client.setCredentials(adminUser.googleCalendarTokens);

          const calendar = google.calendar({
            version: "v3",
            auth: oauth2Client,
          });

          // Delete the event from Google Calendar
          await calendar.events.delete({
            calendarId: "primary",
            eventId: classItem.googleEventId,
          });

          console.log(
            `Deleted Google Calendar event: ${classItem.googleEventId}`,
          );
        }
      } catch (calendarError) {
        console.error("Error deleting calendar event:", calendarError);
        // Continue with class deletion even if calendar deletion fails
      }
    }

    // Delete the class from database
    const result = await classesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 },
      );
    }

    // Notify all enrolled users about class cancellation
    const notifications = db.collection("notifications");
    const notificationsToCreate = [];

    if (classItem.participants && classItem.participants.length > 0) {
      classItem.participants.forEach((participantId) => {
        notificationsToCreate.push({
          userId: new ObjectId(participantId),
          type: "class_cancelled",
          title: "Clase cancelada",
          message: `La clase "${classItem.title}" ha sido cancelada`,
          relatedId: new ObjectId(id),
          relatedType: "class",
          read: false,
          createdAt: new Date(),
          metadata: {
            classTitle: classItem.title,
            startDate: classItem.start_date,
          },
        });
      });
    }

    // Notify admin about class deletion
    if (classItem.createdBy) {
      notificationsToCreate.push({
        userId: new ObjectId(classItem.createdBy),
        type: "class_cancelled",
        title: "Clase eliminada",
        message: `Has eliminado la clase "${classItem.title}"`,
        relatedId: new ObjectId(id),
        relatedType: "class",
        read: false,
        createdAt: new Date(),
        metadata: {
          classTitle: classItem.title,
          startDate: classItem.start_date,
        },
      });
    }

    if (notificationsToCreate.length > 0) {
      await notifications.insertMany(notificationsToCreate);
    }

    return Response.json(
      {
        success: true,
        message: "Clase eliminada con éxito",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al eliminar la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
