import { eventMongoSchema } from "@/utils/definitions";
import clientPromise from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();

    body.date = new Date(body.date); // Dado que JSON convierte todo a string, vuelvo a darle el formato a la fecha

    const parsedEvent = eventMongoSchema.safeParse(body);

    if (!parsedEvent.success) {
      return new Response(JSON.stringify({ error: parsedEvent.error.errors }), {
        status: 400,
      });
    }

    const client = await clientPromise; // Obtener el cliente de MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME); // Seleccionar la base de datos
    const eventsCollection = db.collection("events");

    const result = await eventsCollection.insertOne({
      ...parsedEvent.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    /* Como utilizo el cliente de Mongo, no es necesario cerrar manualmente la conexión con client.close() una vez realizada la operación 
       (el cliente lo maneja automáticamente) */

    /* Response.json() es la forma recomendada de NextJs.
       Añade automáticamente Content-Type: application/json
       y genera un código más limpio (sin JSON.stringify) */

    return Response.json(
      {
        success: true,
        data: {
          id: result.insertedId,
          title: body.title,
        },
        message: "Evento creado con éxito",
      },
      { status: 201 }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
