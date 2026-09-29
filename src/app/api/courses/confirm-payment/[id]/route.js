import { ObjectId } from "mongodb";
import clientPromise from "@/lib/db";
import { prepareNotificationForDB } from "@/models/schemas";
import { handleApiError, requireAdmin } from "@/lib/api/guards";

// PATCH /api/courses/confirm-payment/[id]
// Body: { userId }
// Admin-only: confirms payment for a pending enrollment, moving the user to fully enrolled.
// When a payment gateway (e.g. Mercado Pago) is integrated, its signed webhook
// should call the same confirmation logic instead of this endpoint.
export async function PATCH(req, { params }) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id } = await params;
    const { userId } = body;

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
    const enrollmentsCollection = db.collection("courseEnrollments");
    const coursesCollection = db.collection("courses");

    const enrollment = await enrollmentsCollection.findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(id),
    });

    if (!enrollment) {
      return Response.json(
        { success: false, message: "El usuario no está inscripto en este curso" },
        { status: 404 },
      );
    }

    if (enrollment.paymentStatus === "paid") {
      return Response.json(
        { success: false, message: "El pago ya fue confirmado" },
        { status: 400 },
      );
    }

    const now = new Date();

    // Update enrollment to paid
    await enrollmentsCollection.updateOne(
      { _id: enrollment._id },
      { $set: { paymentStatus: "paid", paidAt: now, updatedAt: now } },
    );

    // Add user to course.participants (now fully enrolled)
    await coursesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $addToSet: { participants: new ObjectId(userId) },
        $set: { updatedAt: now },
      },
    );

    const course = await coursesCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { title: 1, createdBy: 1 } },
    );

    // Notifications
    const notificationsToCreate = [
      prepareNotificationForDB({
        userId: new ObjectId(userId),
        type: "course.payment_confirmed",
        title: "Pago confirmado",
        message: `Tu pago para el curso "${course?.title}" fue confirmado. ¡Ya estás inscripto!`,
        relatedId: new ObjectId(id),
        relatedType: "course",
      }),
    ];
    if (course?.createdBy) {
      notificationsToCreate.push(
        prepareNotificationForDB({
          userId: course.createdBy,
          type: "course.payment_received",
          title: "Pago recibido",
          message: `Se confirmó el pago de un participante para el curso "${course.title}".`,
          relatedId: new ObjectId(id),
          relatedType: "course",
          actorId: new ObjectId(userId),
        }),
      );
    }
    await db.collection("notifications").insertMany(notificationsToCreate);

    return Response.json(
      {
        success: true,
        message: "Pago confirmado. ¡Inscripción completa!",
        data: { paymentStatus: "paid" },
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "Error confirming payment");
  }
}
