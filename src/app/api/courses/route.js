import { CourseFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getServerSession } from "next-auth";
import { prepareCourseForDB } from "@/models/schemas";

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
      end_date: { $max: "$assignedClasses.start_date" },
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

    const matchStage = showAll ? {} : { status: "published" };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    const courses = await coursesCollection
      .aggregate(courseAggregationPipeline(matchStage))
      .toArray();

    return Response.json(
      {
        success: true,
        data: courses,
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json(
      {
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export { courseAggregationPipeline };

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
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

    return Response.json(
      {
        success: true,
        message: `Curso creado con éxito`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error al crear el curso:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
