import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getServerSession } from "next-auth";

// GET /api/notifications - Get all notifications for current user
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const notifications = db.collection("notifications");

    // Delete notifications older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await notifications.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
    });

    const userNotifications = await notifications
      .find({ userId: new ObjectId(session.user.id) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await notifications.countDocuments({
      userId: new ObjectId(session.user.id),
    });

    return NextResponse.json({
      data: userNotifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Delete all read notifications for current user
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const notifications = db.collection("notifications");

    const result = await notifications.deleteMany({
      userId: new ObjectId(session.user.id),
      read: true,
    });

    return NextResponse.json({
      message: `${result.deletedCount} notificaciones eliminadas`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}
