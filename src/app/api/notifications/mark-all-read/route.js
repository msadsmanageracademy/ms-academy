import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
export async function PATCH(req) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const notifications = db.collection("notifications");

    const result = await notifications.updateMany(
      {
        userId: new ObjectId(session.user.id),
        read: false,
      },
      {
        $set: { read: true },
      }
    );

    return NextResponse.json({
      message: "Todas las notificaciones marcadas como leídas",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
