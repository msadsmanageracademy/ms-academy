import { CourseFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getServerSession } from "next-auth";
import { prepareCourseForDB } from "@/models/schemas";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    const courses = await coursesCollection
      .find({})
      .sort({ start_date: 1 }) // Ascendente
      .toArray();

    return Response.json(
      {
        success: true,
        data: courses,
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    // Dado que JSON convierte todo a string, vuelvo a darle el formato a la fechas
    if (body.start_date) body.start_date = new Date(body.start_date);
    if (body.end_date) body.end_date = new Date(body.end_date);

    const parsedBody = CourseFormSchema.safeParse(body);

    if (!parsedBody.success) {
      return Response.json(
        {
          success: false,
          message: "El formato de los datos es inválido",
          details: parsedBody.error.errors,
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    // Prepare data for DB with server-side fields
    const courseData = prepareCourseForDB(
      body,
      session?.user?.id ? new ObjectId(session.user.id) : undefined
    );

    await coursesCollection.insertOne(courseData);

    return Response.json(
      {
        success: true,
        message: `Curso creado con éxito`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear el curso:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
