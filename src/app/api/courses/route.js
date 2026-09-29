import { CourseFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { prepareCourseForDB } from "@/models/schemas";
import { handleApiError, isAdmin, requireAdmin } from "@/lib/api/guards";

const courseAggregationPipeline = (matchStage = {}) => [
  { $match: matchStage },
  {
    $lookup: {
      from: "classes",
      let: { courseId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$courseId", "$$courseId"] } } },
        { $sort: { start_date: 1 } },
      ],
      as: "assignedClasses",
    },
  },
  {
    $addFields: {
      amount_of_classes: { $size: "$assignedClasses" },
      start_date: { $min: "$assignedClasses.start_date" },
      end_date: {
        $max: {
          $map: {
            input: "$assignedClasses",
            as: "c",
            in: {
              $add: ["$$c.start_date", { $multiply: ["$$c.duration", 60000] }],
            },
          },
        },
      },
      total_duration: { $sum: "$assignedClasses.duration" },
    },
  },
  { $unset: "assignedClasses" },
  { $sort: { createdAt: -1 } },
];

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("showAll") === "true";

    const session = showAll ? await requireAdmin() : await auth();

    const matchStage = showAll ? {} : { status: "published" };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    const courses = await coursesCollection
      .aggregate(courseAggregationPipeline(matchStage))
      .toArray();

    // Attach userPaymentStatus for authenticated users
    if (session?.user?.id) {
      const userId = new ObjectId(session.user.id);
      const enrollments = await db
        .collection("courseEnrollments")
        .find(
          { userId, courseId: { $in: courses.map((c) => c._id) } },
          { projection: { courseId: 1, paymentStatus: 1 } },
        )
        .toArray();
      const enrollmentMap = Object.fromEntries(
        enrollments.map((e) => [e.courseId.toString(), e.paymentStatus]),
      );
      for (const course of courses) {
        course.userPaymentStatus = enrollmentMap[course._id.toString()] ?? null;
      }
    }

    if (courses.length > 0) {
      const allEnrollments = await db
        .collection("courseEnrollments")
        .find(
          { courseId: { $in: courses.map((c) => c._id) } },
          { projection: { courseId: 1, paymentStatus: 1 } },
        )
        .toArray();
      const countMap = {};
      for (const e of allEnrollments) {
        const key = e.courseId.toString();
        if (!countMap[key]) countMap[key] = { total: 0, paid: 0 };
        countMap[key].total++;
        if (e.paymentStatus === "paid") countMap[key].paid++;
      }
      const admin = isAdmin(session);
      for (const course of courses) {
        const counts = countMap[course._id.toString()] ?? { total: 0, paid: 0 };
        course.enrollmentCount = counts.total;
        if (admin) {
          course.enrolledCount = counts.total;
          course.paidCount = counts.paid;
        } else {
          delete course.participants;
          delete course.createdBy;
        }
      }
    }

    if (courses.length > 0) {
      const reviewAggregates = await db
        .collection("reviews")
        .aggregate([
          { $match: { courseId: { $in: courses.map((c) => c._id) } } },
          {
            $group: {
              _id: "$courseId",
              avgRating: { $avg: "$rating" },
              reviewCount: { $sum: 1 },
            },
          },
        ])
        .toArray();
      const reviewMap = Object.fromEntries(
        reviewAggregates.map((r) => [
          r._id.toString(),
          { avgRating: r.avgRating, reviewCount: r.reviewCount },
        ]),
      );
      for (const course of courses) {
        const r = reviewMap[course._id.toString()] ?? {
          avgRating: null,
          reviewCount: 0,
        };
        course.avgRating = r.avgRating
          ? Math.round(r.avgRating * 10) / 10
          : null;
        course.reviewCount = r.reviewCount;
      }
    }

    return Response.json(
      {
        success: true,
        data: courses,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "Error al obtener los cursos");
  }
}

export { courseAggregationPipeline };

export async function POST(req) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const parsedBody = CourseFormSchema.safeParse(body);

    if (!parsedBody.success) {
      return Response.json(
        {
          success: false,
          message: "El formato de los datos es inválido",
          details: parsedBody.error.errors,
        },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    // Prepare data for DB with server-side fields
    const courseData = prepareCourseForDB(
      parsedBody.data,
      session?.user?.id ? new ObjectId(session.user.id) : undefined,
    );

    const result = await coursesCollection.insertOne(courseData);

    // Self-reference: courseSeriesId = own _id (first iteration in its series)
    await coursesCollection.updateOne(
      { _id: result.insertedId },
      { $set: { courseSeriesId: result.insertedId } },
    );

    return Response.json(
      {
        success: true,
        message: `Curso creado con éxito`,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "Error al crear el curso");
  }
}
