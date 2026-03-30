import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { Resend } from "resend";
import { z } from "zod";
import clientPromise from "@/lib/db";
import { prepareNotificationForDB } from "@/models/schemas";
import { EmailTemplate } from "@/views/components/layout/EmailTemplate";

const ContactSchema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .trim(),
  email: z.string().email({ message: "Ingresá un email válido" }).trim(),
  subject: z
    .string()
    .min(3, { message: "El asunto debe tener al menos 3 caracteres" })
    .trim(),
  message: z
    .string()
    .min(10, { message: "El mensaje debe tener al menos 10 caracteres" })
    .trim(),
});

// POST /api/contact - Submit a contact form message
export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = ContactSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Datos inválidos", errors },
        { status: 400 },
      );
    }

    const { name, email, subject, message } = parsed.data;

    // ── In-app notification ──────────────────────────────────────────────────
    const adminId = process.env.ADMIN_USER_ID;
    if (adminId && ObjectId.isValid(adminId)) {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      const notification = prepareNotificationForDB({
        userId: new ObjectId(adminId),
        type: "contact.message",
        title: "Nuevo mensaje de contacto",
        message: `${name} (${email}) escribió: ${subject}`,
        relatedType: "contact",
        metadata: { senderName: name, senderEmail: email, subject, message },
      });
      await db.collection("notifications").insertOne(notification);
    }

    // ── Email via Resend ─────────────────────────────────────────────────────
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error: resendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: process.env.CONTACT_RECIPIENT_EMAIL,
      replyTo: email,
      subject: `[Contacto] ${subject}`,
      react: EmailTemplate({
        name,
        email,
        subject,
        message,
        logoUrl: process.env.EMAIL_LOGO_URL || "",
      }),
    });

    if (resendError) {
      console.error("Resend error:", resendError);
    } else {
      console.log("Resend email sent:", data?.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending contact message:", error);
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje. Intentá de nuevo más tarde." },
      { status: 500 },
    );
  }
}
