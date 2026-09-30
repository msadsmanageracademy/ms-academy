import { getActor, handleApiError, ok, readJson } from "@/lib/api/guards";
import { getUser, updateOwnProfile } from "@/server/users/service";

// GET /api/users/[id] — the user themselves or an admin
export async function GET(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    return ok({ data: await getUser(actor, id) });
  } catch (error) {
    return handleApiError(error, "Error fetching user");
  }
}

// PATCH /api/users/[id] — own profile only
export async function PATCH(req, { params }) {
  try {
    const actor = await getActor();
    const { id } = await params;
    const changes = await updateOwnProfile(actor, id, await readJson(req));
    // `data.first_name` lets the client refresh the name shown in the session
    return ok({ message: "Información actualizada con éxito", data: { first_name: changes.first_name } });
  } catch (error) {
    return handleApiError(error, "Error updating user");
  }
}
