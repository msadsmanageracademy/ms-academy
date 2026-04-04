import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/reviews — returns all reviews left by the current user
// Returns: { courseId?, classId?, rating, comment, ... }[]
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { success: false, message: "No autenticado" },
        { status: 401 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    const reviews = await db
      .collection("reviews")
      .find({ userId: new ObjectId(session.user.id) })
      .project({ courseId: 1, classId: 1, rating: 1, comment: 1, updatedAt: 1 })
      .toArray();

    return Response.json({ success: true, data: reviews }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
