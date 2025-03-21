import { EventFormSchema } from "@/utils/definitions";
import clientPromise from "@/lib/db";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const eventsCollection = db.collection("events");

    const currentDate = new Date(); // Fecha actual

    const events = await eventsCollection
      .find({ start_date: { $gt: currentDate } })
      .sort({ start_date: 1 }) // Ascendente
      .toArray();

    return Response.json(
      {
        success: true,
        data: events,
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

    const parsedBody = EventFormSchema.safeParse(body);

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

    const client = await clientPromise; // Obtener el cliente de MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME); // Seleccionar la base de datos
    const eventsCollection = db.collection("events");

    await eventsCollection.insertOne(body);

    /* Como utilizo el cliente de Mongo, no es necesario cerrar manualmente la conexión con client.close() una vez realizada la operación 
       (el cliente lo maneja automáticamente) */

    /* Response.json() es la forma recomendada de NextJs.
       Añade automáticamente Content-Type: application/json
       y genera un código más limpio (sin JSON.stringify) */

    return Response.json(
      {
        success: true,
        message: `Evento ${body.title} creado con éxito`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al inscribirse al evento:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
