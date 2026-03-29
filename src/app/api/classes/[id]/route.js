import { ClassFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import {
  addTimestampToUpdate,
  prepareNotificationForDB,
} from "@/models/schemas";
import clientPromise from "@/lib/db";
import { google } from "googleapis";

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase invÃ¡lido",
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
          message: "ID de clase invÃ¡lido",
        },
        { status: 400 },
      );

    // Status-only toggle â€” skip full form validation
    if (Object.keys(body).length === 1 && "status" in body) {
      if (!["draft", "published"].includes(body.status)) {
        return Response.json(
          { success: false, message: "Estado invÃ¡lido" },
          { status: 400 },
        );
      }
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      const result = await db
        .collection("classes")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: body.status, updatedAt: new Date() } },
        );
      if (result.matchedCount === 0) {
        return Response.json(
          { success: false, message: "Clase no encontrada" },
          { status: 404 },
        );
      }
      // Notify admin about status change
      const classForNotif = await db
        .collection("classes")
        .findOne(
          { _id: new ObjectId(id) },
          { projection: { title: 1, createdBy: 1 } },
        );
      if (classForNotif?.createdBy) {
        const statusLabel =
          body.status === "published" ? "publicada" : "movida a borrador";
        await db.collection("notifications").insertOne(
          prepareNotificationForDB({
            userId: classForNotif.createdBy,
            type: "class.status_changed",
            title: "Estado de clase actualizado",
            message: `La clase "${classForNotif.title}" fue ${statusLabel}`,
            relatedId: new ObjectId(id),
            relatedType: "class",
            actorId: classForNotif.createdBy,
          }),
        );
      }
      return Response.json(
        { success: true, message: "Estado actualizado" },
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
          message: "El formato de los datos es invÃ¡lido",
          details: parsedBody.error.errors,
        },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");
    const usersCollection = db.collection("users");
    const coursesCollection = db.collection("courses");

    // Get the existing class to check calendar event and current courseId
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
        message: "Clase actualizada con Ã©xito",
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
          message: "ID de clase invÃ¡lido",
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
        message: "Clase eliminada con Ã©xito",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al eliminar la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
