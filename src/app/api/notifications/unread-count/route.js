import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";

// GET /api/notifications/unread-count - Get unread notification count
export async function GET(req) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const notifications = db.collection("notifications");

    const count = await notifications.countDocuments({
      userId: new ObjectId(session.user.id),
      read: false,
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}
