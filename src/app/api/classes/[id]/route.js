import { ClassFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { google } from "googleapis";

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
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
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        data: classItem,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al obtener la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
      );

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
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");
    const usersCollection = db.collection("users");

    // Get the existing class to check if it has a calendar event
    const existingClass = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingClass) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 }
      );
    }

    // Update the class in database
    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: body }
    );

    if (result.matchedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 }
      );
    }

    // Create notifications
    const notifications = db.collection("notifications");
    const notificationsToCreate = [];

    // Notify admin about modification
    if (existingClass.createdBy) {
      notificationsToCreate.push({
        userId: new ObjectId(existingClass.createdBy),
        type: "class_modified",
        title: "Clase modificada",
        message: `Has modificado la clase "${
          body.title || existingClass.title
        }"`,
        relatedId: new ObjectId(id),
        relatedType: "class",
        read: false,
        createdAt: new Date(),
        metadata: {
          classTitle: body.title || existingClass.title,
        },
      });
    }

    // Notify all enrolled users about modification
    if (existingClass.participants && existingClass.participants.length > 0) {
      existingClass.participants.forEach((participantId) => {
        notificationsToCreate.push({
          userId: new ObjectId(participantId),
          type: "class_modified",
          title: "Clase modificada",
          message: `La clase "${
            body.title || existingClass.title
          }" ha sido modificada`,
          relatedId: new ObjectId(id),
          relatedType: "class",
          read: false,
          createdAt: new Date(),
          metadata: {
            classTitle: body.title || existingClass.title,
          },
        });
      });
    }

    if (notificationsToCreate.length > 0) {
      await notifications.insertMany(notificationsToCreate);
    }

    // If class has a Google Calendar event, update it only if relevant fields changed
    const relevantFieldsChanged =
      (body.title && body.title !== existingClass.title) ||
      (body.short_description &&
        body.short_description !== existingClass.short_description) ||
      (body.start_date &&
        new Date(body.start_date).getTime() !==
          new Date(existingClass.start_date).getTime()) ||
      (body.duration && body.duration !== existingClass.duration);

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
            `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`
          );

          oauth2Client.setCredentials(adminUser.googleCalendarTokens);

          const calendar = google.calendar({
            version: "v3",
            auth: oauth2Client,
          });

          // Calculate end time (start time + duration in minutes)
          const startDate = new Date(
            body.start_date || existingClass.start_date
          );
          const endDate = new Date(startDate);
          const duration = body.duration || existingClass.duration;
          endDate.setMinutes(endDate.getMinutes() + duration);

          // Update the event in Google Calendar
          await calendar.events.patch({
            calendarId: "primary",
            eventId: existingClass.googleEventId,
            resource: {
              summary: body.title || existingClass.title,
              description:
                body.short_description || existingClass.short_description || "",
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
            `Updated Google Calendar event: ${existingClass.googleEventId}`
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
      { status: 200 }
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
        { status: 400 }
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
        { status: 404 }
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
            `${process.env.NEXTAUTH_URL}/api/google-calendar/callback`
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
            `Deleted Google Calendar event: ${classItem.googleEventId}`
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
        { status: 404 }
      );
    }

    // Notify all enrolled users about class cancellation
    if (classItem.participants && classItem.participants.length > 0) {
      const notifications = db.collection("notifications");
      const notificationsToCreate = classItem.participants.map(
        (participantId) => ({
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
        })
      );

      if (notificationsToCreate.length > 0) {
        await notifications.insertMany(notificationsToCreate);
      }
    }

    return Response.json(
      {
        success: true,
        message: "Clase eliminada con éxito",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al eliminar la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
