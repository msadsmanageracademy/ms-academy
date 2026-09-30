// Contact form: in-app notification for the admin + email through Resend.
import { Resend } from "resend";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { HttpError, parseOrThrow } from "@/server/errors";
import { notify } from "@/server/notifications";
import { EmailTemplate } from "@/views/components/layout/EmailTemplate";
import { ObjectId } from "mongodb";

const ContactSchema = z.object({
  name: z.string().trim().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  email: z.string().trim().email({ message: "Ingresá un email válido" }),
  subject: z.string().trim().min(3, { message: "El asunto debe tener al menos 3 caracteres" }),
  message: z.string().trim().min(10, { message: "El mensaje debe tener al menos 10 caracteres" }),
});

/**
 * Validates and delivers a contact message. The in-app notification is best effort;
 * the email is what the sender relies on, so its failure is reported.
 */
export async function sendContactMessage(input) {
  const { name, email, subject, message } = parseOrThrow(ContactSchema, input, {
    useIssueMessage: true,
  });

  const adminId = process.env.ADMIN_USER_ID;
  if (adminId && ObjectId.isValid(adminId)) {
    try {
      await notify(await getDb(), "contact.message", {
        to: adminId,
        vars: { name, email, subject },
        metadata: { senderName: name, senderEmail: email, subject, message },
      });
    } catch (error) {
      logger.error("Could not create the contact notification", error);
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: process.env.CONTACT_RECIPIENT_EMAIL,
    replyTo: email,
    subject: `[Contacto] ${subject}`,
    react: EmailTemplate({ name, email, subject, message, logoUrl: process.env.EMAIL_LOGO_URL || "" }),
  });
  if (error) {
    logger.error("Resend error sending contact message", error);
    throw new HttpError(502, "No se pudo enviar el mensaje. Intentá de nuevo más tarde.");
  }
  logger.info("Contact email sent", { emailId: data?.id });
}
