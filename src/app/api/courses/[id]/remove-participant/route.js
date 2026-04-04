import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { auth } from "@/lib/auth";
import { prepareNotificationForDB } from "@/models/schemas";

// DELETE /api/courses/[id]/remove-participant?userId=...
// Admin-only: removes a participant from a course, its linked classes, and deletes their enrollment.
export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { success: false, message: "No autenticado" },
        { status: 401 },
      );
    }
    if (session.user.role !== "admin") {
      return Response.json(
        { success: false, message: "Acceso denegado" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        { success: false, message: "ID de curso inválido" },
        { status: 400 },
      );

    if (!ObjectId.isValid(userId))
      return Response.json(
        { success: false, message: "ID de usuario inválido" },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const classesCollection = db.collection("classes");
    const enrollmentsCollection = db.collection("courseEnrollments");

    const course = await coursesCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { title: 1 } },
    );
    if (!course) {
      return Response.json(
        { success: false, message: "Curso no encontrado" },
        { status: 404 },
      );
    }

    // Delete enrollment doc (ignore if not found — remove may still proceed)
    const existingEnrollment = await enrollmentsCollection.findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(id),
    });

    if (existingEnrollment?.paymentStatus === "paid") {
      return Response.json(
        {
          success: false,
          message:
            "No se puede remover a un participante que ya ha pagado el curso",
        },
        { status: 403 },
      );
    }

    await enrollmentsCollection.deleteOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(id),
    });

    // Remove from course.participants and all linked classes
    await coursesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $pull: { participants: new ObjectId(userId) },
        $set: { updatedAt: new Date() },
      },
    );
    await classesCollection.updateMany(
      { courseId: new ObjectId(id) },
      {
        $pull: { participants: new ObjectId(userId) },
        $set: { updatedAt: new Date() },
      },
    );

    // Notify the removed user
    await db.collection("notifications").insertOne(
      prepareNotificationForDB({
        userId: new ObjectId(userId),
        type: "course.removed_by_admin",
        title: "Removido del curso",
        message: `Fuiste removido del curso "${course.title}" por el administrador.`,
        relatedId: new ObjectId(id),
        relatedType: "course",
      }),
    );

    return Response.json(
      { success: true, message: "Participante removido con éxito" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al remover participante:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
