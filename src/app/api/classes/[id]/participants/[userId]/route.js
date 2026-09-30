import { removeClassParticipant } from "@/server/classes/participants";
import { getActor, handleApiError, ok } from "@/lib/api/guards";

// DELETE /api/classes/[id]/participants/[userId] — the user leaves, or an admin removes them
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id, userId } = await params;
    await removeClassParticipant(actor, id, userId);
    return ok({
      message:
        userId === actor?.id ? "Inscripción cancelada con éxito" : "Participante removido con éxito",
    });
  } catch (error) {
    return handleApiError(error, "Error removing class participant");
  }
}
