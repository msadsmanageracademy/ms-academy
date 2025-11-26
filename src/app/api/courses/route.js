import { CourseFormSchema } from "@/utils/validation";
import clientPromise from "@/lib/db";

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
    const body = await req.json();

    // Dado que JSON convierte todo a string, vuelvo a darle el formato a la fechas
    if (body.start_date) body.start_date = new Date(body.start_date);
    if (body.end_date) body.end_date = new Date(body.end_date);

    // Set type to course
    body.type = "course";

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

    await coursesCollection.insertOne(body);

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
