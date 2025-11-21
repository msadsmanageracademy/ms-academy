import clientPromise from "@/lib/db";
import { ObjectId } from "mongodb";
import { ClassFormSchema } from "@/utils/validation";

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const classItem = await classesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!classItem) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        data: classItem,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al obtener la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
      );

    if (body.start_date) body.start_date = new Date(body.start_date);
    if (body.end_date) body.end_date = new Date(body.end_date);

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

    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: body }
    );

    if (result.matchedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Clase actualizada con éxito",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al actualizar la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de clase inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const classesCollection = db.collection("classes");

    const result = await classesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Clase no encontrada",
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Clase eliminada con éxito",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al eliminar la clase:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
