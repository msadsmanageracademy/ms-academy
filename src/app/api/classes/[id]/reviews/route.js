import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/lib/auth";
import { ReviewFormSchema } from "@/utils/validation";

// GET /api/classes/[id]/reviews — list all reviews for a class
export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return Response.json(
        { success: false, message: "ID de clase inválido" },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    const reviews = await db
      .collection("reviews")
      .find({ classId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({ success: true, data: reviews }, { status: 200 });
  } catch (error) {
    console.error("Error fetching class reviews:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

// POST /api/classes/[id]/reviews — submit or update a review
// Eligibility: user must be a participant AND the class must have already ended
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
        { success: false, message: "ID de clase inválido" },
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
    const classId = new ObjectId(id);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    if (session.user.role !== "admin") {
      const classItem = await db.collection("classes").findOne(
        { _id: classId },
        {
          projection: {
            participants: 1,
            start_date: 1,
            duration: 1,
            status: 1,
          },
        },
      );

      if (!classItem) {
        return Response.json(
          { success: false, message: "Clase no encontrada" },
          { status: 404 },
        );
      }

      const isParticipant = classItem.participants?.some(
        (p) => p.toString() === session.user.id,
      );
      if (!isParticipant) {
        return Response.json(
          { success: false, message: "No sos participante de esta clase" },
          { status: 403 },
        );
      }

      const endTime =
        new Date(classItem.start_date).getTime() +
        classItem.duration * 60 * 1000;
      if (Date.now() < endTime) {
        return Response.json(
          {
            success: false,
            message:
              "Solo podés dejar una reseña una vez que la clase haya finalizado",
          },
          { status: 403 },
        );
      }
    }

    const now = new Date();
    const reviewData = {
      classId,
      userId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? "",
      firstName: session.user.name ?? session.user.email,
      updatedAt: now,
    };

    // Upsert: one review per user per class
    const result = await db
      .collection("reviews")
      .findOneAndUpdate(
        { classId, userId },
        { $set: reviewData, $setOnInsert: { createdAt: now } },
        { upsert: true, returnDocument: "after" },
      );

    return Response.json(
      { success: true, message: "Reseña guardada", data: result },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error saving class review:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
