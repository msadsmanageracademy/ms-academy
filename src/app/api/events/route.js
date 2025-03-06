import { MongoClient } from "mongodb";
import { eventMongoSchema } from "@/utils/definitions";

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

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME); // Seleccionar la base de datos
    const eventsCollection = db.collection("events");

    const result = await eventsCollection.insertOne({
      ...parsedEvent.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    client.close();

    return new Response(
      JSON.stringify({ message: "Evento creado", id: result.insertedId }),
      { status: 201 }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
