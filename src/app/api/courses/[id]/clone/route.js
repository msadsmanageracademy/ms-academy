import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";

// POST /api/courses/[id]/clone — create a new iteration of an existing course
export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (session?.user?.role !== "admin") {
      return Response.json(
        { success: false, message: "No autorizado" },
        { status: 403 },
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "ID de curso inválido" },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    const original = await db
      .collection("courses")
      .findOne({ _id: new ObjectId(id) });

    if (!original) {
      return Response.json(
        { success: false, message: "Curso no encontrado" },
        { status: 404 },
      );
    }

    // Inherit courseSeriesId from the original (or fall back to its own _id for
    // courses created before the series feature was introduced)
    const courseSeriesId = original.courseSeriesId ?? original._id;

    const now = new Date();
    const { _id, participants, status, createdAt, updatedAt, ...rest } =
      original;

    const clonedCourse = {
      ...rest,
      courseSeriesId,
      participants: [],
      status: "draft",
      createdBy: new ObjectId(session.user.id),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("courses").insertOne(clonedCourse);
    const newCourseId = result.insertedId;

    // Clone all classes assigned to the original course.
    // New classes: same title/duration/description/price, no start_date,
    // status "enrolled", linked to the new course, empty participants.
    const originalClasses = await db
      .collection("classes")
      .find({ courseId: new ObjectId(id) })
      .toArray();

    if (originalClasses.length > 0) {
      const clonedClasses = originalClasses.map(
        ({
          _id: _classId,
          participants,
          status,
          courseId,
          start_date,
          googleEventId,
          googleEventUrl,
          googleMeetLink,
          calendarEventLink,
          recording_url,
          resources,
          createdAt: _ca,
          updatedAt: _ua,
          ...classRest
        }) => ({
          ...classRest,
          courseId: newCourseId,
          status: "enrolled",
          participants: [],
          max_participants: null,
          start_date: null,
          resources: [],
          createdBy: new ObjectId(session.user.id),
          createdAt: now,
          updatedAt: now,
        }),
      );

      await db.collection("classes").insertMany(clonedClasses);
    }

    return Response.json(
      {
        success: true,
        message: "Curso clonado con éxito",
        data: { _id: result.insertedId },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error cloning course:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
