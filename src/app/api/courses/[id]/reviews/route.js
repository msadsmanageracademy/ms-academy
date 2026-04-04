import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/lib/auth";
import { ReviewFormSchema } from "@/utils/validation";

// GET /api/courses/[id]/reviews — list reviews for a course.
// Pass ?series=true to aggregate reviews across all iterations sharing the same courseSeriesId.
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const series = searchParams.get("series") === "true";

    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "ID de curso inválido" },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    let courseIds = [new ObjectId(id)];

    if (series) {
      // Resolve the series root: use this course's courseSeriesId if present,
      // otherwise fall back to its own _id (pre-feature courses).
      const course = await db
        .collection("courses")
        .findOne(
          { _id: new ObjectId(id) },
          { projection: { courseSeriesId: 1 } },
        );
      const seriesId = course?.courseSeriesId ?? new ObjectId(id);

      const siblings = await db
        .collection("courses")
        .find({ courseSeriesId: seriesId }, { projection: { _id: 1 } })
        .toArray();
      courseIds = siblings.map((c) => c._id);
    }

    const reviews = await db
      .collection("reviews")
      .find({ courseId: { $in: courseIds } })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({ success: true, data: reviews }, { status: 200 });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

// POST /api/courses/[id]/reviews — submit or update a review
export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { success: false, message: "No autenticado" },
        { status: 401 },
      );
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "ID de curso inválido" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = ReviewFormSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: parsed.error.errors[0]?.message || "Datos inválidos",
        },
        { status: 400 },
      );
    }

    const userId = new ObjectId(session.user.id);
    const courseId = new ObjectId(id);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    // Only paid-enrolled users can review
    if (session.user.role !== "admin") {
      const enrollment = await db.collection("courseEnrollments").findOne({
        userId,
        courseId,
        paymentStatus: "paid",
      });
      if (!enrollment) {
        return Response.json(
          {
            success: false,
            message:
              "Solo inscriptos con pago confirmado pueden dejar una reseña",
          },
          { status: 403 },
        );
      }
    }

    const now = new Date();
    const reviewData = {
      courseId,
      userId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? "",
      firstName: session.user.name ?? session.user.email,
      updatedAt: now,
    };

    // Upsert: one review per user per course
    const result = await db
      .collection("reviews")
      .findOneAndUpdate(
        { courseId, userId },
        { $set: reviewData, $setOnInsert: { createdAt: now } },
        { upsert: true, returnDocument: "after" },
      );

    return Response.json(
      { success: true, message: "Reseña guardada", data: result },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error saving review:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
