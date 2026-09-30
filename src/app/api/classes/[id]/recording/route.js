import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { removeClassRecording, setClassRecording } from "@/server/classes/service";

// PUT /api/classes/[id]/recording { url } — admin: sets the recording of a course class
export async function PUT(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await setClassRecording(actor, id, await readJson(req));
    return ok({ message: "Grabación guardada" });
  } catch (error) {
    return handleApiError(error, "Error saving class recording");
  }
}

// DELETE /api/classes/[id]/recording — admin
export async function DELETE(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    await removeClassRecording(actor, id);
    return ok({ message: "Grabación eliminada" });
  } catch (error) {
    return handleApiError(error, "Error removing class recording");
  }
}
