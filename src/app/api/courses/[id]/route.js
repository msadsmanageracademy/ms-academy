import { CourseFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { addTimestampToUpdate } from "@/models/schemas";
import clientPromise from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de curso inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    const course = await coursesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!course) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        data: course,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al obtener el curso:", error);
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
          message: "ID de curso inválido",
        },
        { status: 400 }
      );

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

    const updateData = addTimestampToUpdate({
      ...body,
      max_participants:
        body.max_participants === 0 ? null : body.max_participants,
    });

    const result = await coursesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Curso actualizado con éxito",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al actualizar el curso:", error);
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
          message: "ID de curso inválido",
        },
        { status: 400 }
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    const result = await coursesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Curso eliminado con éxito",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al eliminar el curso:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
