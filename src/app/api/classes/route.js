import { ClassFormSchema } from "@/utils/validation";
import clientPromise from "@/lib/db";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const currentDate = new Date();

    const classes = await classesCollection
      .find({ start_date: { $gt: currentDate } })
      .sort({ start_date: 1 }) // Ascendente
      .toArray();

    return Response.json(
      {
        success: true,
        data: classes,
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

    // Set type to class
    body.type = "class";

    const parsedBody = ClassFormSchema.safeParse(body);

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
    const classesCollection = db.collection("classes");

    await classesCollection.insertOne(body);

    return Response.json(
      {
        success: true,
        message: `Clase creada con éxito`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
