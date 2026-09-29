import { ClassReminderEmail } from "@/views/components/layout/ClassReminderEmail";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { Resend } from "resend";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { formatLongDateAtTime } from "@/utils/dates";
import { prepareNotificationForDB } from "@/models/schemas";

export async function POST(req, { params }) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "No autorizado" },
        { status: 401 },
      );
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "ID de clase inválido" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { participantIds } = body;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);

    const classItem = await db
      .collection("classes")
      .findOne({ _id: new ObjectId(id) });

    if (!classItem) {
      return NextResponse.json(
        { success: false, message: "Clase no encontrada" },
        { status: 404 },
      );
    }

    let targetIds = classItem.participants?.map((p) => p.toString()) || [];

    if (classItem.courseId) {
      const paidEnrollments = await db
        .collection("courseEnrollments")
        .find(
          { courseId: classItem.courseId, paymentStatus: "paid" },
          { projection: { userId: 1 } },
        )
        .toArray();
      const paidIds = new Set(paidEnrollments.map((e) => e.userId.toString()));
      targetIds = targetIds.filter((pid) => paidIds.has(pid));
    }

    if (participantIds !== undefined && !Array.isArray(participantIds)) {
      return NextResponse.json(
        { success: false, message: "participantIds debe ser una lista" },
        { status: 400 },
      );
    }

    if (participantIds && participantIds.length > 0) {
      const validIds = participantIds.filter((pid) =>
        targetIds.includes(pid.toString()),
      );
      if (validIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Ningún participante válido para notificar",
          },
          { status: 400 },
        );
      }
      targetIds = validIds;
    }

    if (targetIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay participantes para notificar" },
        { status: 400 },
      );
    }

    // Fetch user details for target participants
    const users = await db
      .collection("users")
      .find(
        { _id: { $in: targetIds.map((uid) => new ObjectId(uid)) } },
        { projection: { email: 1, first_name: 1 } },
      )
      .toArray();

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: "No se encontraron usuarios" },
        { status: 404 },
      );
    }

    const formattedDate = formatLongDateAtTime(classItem.start_date);

    const emailProps = {
      className: classItem.title,
      description: classItem.short_description || "",
      startDate: formattedDate,
      duration: classItem.duration,
      googleMeetLink: classItem.googleMeetLink || null,
      logoUrl: process.env.EMAIL_LOGO_URL || "",
    };

    // Send emails via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (users.length === 1) {
      const { error: resendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: users[0].email,
        replyTo: session.user.email,
        subject: `Recordatorio: ${classItem.title}`,
        react: ClassReminderEmail(emailProps),
      });

      if (resendError) {
        console.error("Resend error:", resendError);
        return NextResponse.json(
          { success: false, message: "Error al enviar el email" },
          { status: 500 },
        );
      }
    } else {
      const emails = users.map((user) => ({
        from: process.env.RESEND_FROM_EMAIL,
        to: user.email,
        replyTo: session.user.email,
        subject: `Recordatorio: ${classItem.title}`,
        react: ClassReminderEmail(emailProps),
      }));

      const { error: resendError } = await resend.batch.send(emails);

      if (resendError) {
        console.error("Resend batch error:", resendError);
        return NextResponse.json(
          { success: false, message: "Error al enviar los emails" },
          { status: 500 },
        );
      }
    }

    const notifications = users.map((user) =>
      prepareNotificationForDB({
        userId: user._id,
        type: "class.reminder",
        title: "Recordatorio de clase",
        message: `Tu clase "${classItem.title}" es el ${formattedDate}`,
        relatedId: classItem._id,
        relatedType: "class",
      }),
    );

    if (notifications.length > 0) {
      await db.collection("notifications").insertMany(notifications);
    }

    return NextResponse.json({
      success: true,
      notifiedCount: users.length,
    });
  } catch (error) {
    console.error("Error sending class reminder:", error);
    return NextResponse.json(
      { success: false, message: "Error en el servidor" },
      { status: 500 },
    );
  }
}
