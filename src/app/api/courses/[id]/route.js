import { CourseFormSchema } from "@/utils/validation";
import { ObjectId } from "mongodb";
import { addTimestampToUpdate } from "@/models/schemas";
import clientPromise from "@/lib/db";

const courseAggregationPipeline = (matchStage) => [
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
];

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id))
      return Response.json(
        {
          success: false,
          message: "ID de curso inválido",
        },
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");

    const results = await coursesCollection
      .aggregate(courseAggregationPipeline({ _id: new ObjectId(id) }))
      .toArray();

    const course = results[0];

    if (!course) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    return Response.json(
      {
        success: true,
        data: course,
      },
      { status: 200 },
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
        { status: 400 },
      );

    // Status-only toggle — skip full form validation
    if (Object.keys(body).length === 1 && "status" in body) {
      if (!["draft", "published"].includes(body.status)) {
        return Response.json(
          { success: false, message: "Estado inválido" },
          { status: 400 },
        );
      }
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);
      if (body.status === "published") {
        const classCount = await db
          .collection("classes")
          .countDocuments({ courseId: new ObjectId(id) });
        if (classCount === 0) {
          return Response.json(
            {
              success: false,
              message:
                "No se puede publicar un curso sin clases asignadas. Asignale al menos una clase primero.",
            },
            { status: 400 },
          );
        }
      }
      const result = await db
        .collection("courses")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: body.status, updatedAt: new Date() } },
        );
      if (result.matchedCount === 0) {
        return Response.json(
          { success: false, message: "Curso no encontrado" },
          { status: 404 },
        );
      }
      return Response.json(
        { success: true, message: "Estado actualizado" },
        { status: 200 },
      );
    }

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
    const classesCollection = db.collection("classes");

    // If trying to publish, require at least one assigned class
    if (parsedBody.data.status === "published") {
      const classCount = await classesCollection.countDocuments({
        courseId: new ObjectId(id),
      });
      if (classCount === 0) {
        return Response.json(
          {
            success: false,
            message:
              "No se puede publicar un curso sin clases asignadas. Asignale al menos una clase primero.",
          },
          { status: 400 },
        );
      }
    }

    const { status, ...fieldsToUpdate } = parsedBody.data;

    const updateData = addTimestampToUpdate({
      ...fieldsToUpdate,
      max_participants:
        fieldsToUpdate.max_participants === 0
          ? null
          : fieldsToUpdate.max_participants,
    });

    if (status !== undefined) {
      updateData.status = status;
    }

    const result = await coursesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    return Response.json(
      {
        success: true,
        message: "Curso actualizado con éxito",
      },
      { status: 200 },
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
        { status: 400 },
      );

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const coursesCollection = db.collection("courses");
    const classesCollection = db.collection("classes");

    // Verify the course exists before deleting
    const course = await coursesCollection.findOne({ _id: new ObjectId(id) });
    if (!course) {
      return Response.json(
        {
          success: false,
          message: "Curso no encontrado",
        },
        { status: 404 },
      );
    }

    // Unassign all classes from this course and revert them to draft
    await classesCollection.updateMany(
      { courseId: new ObjectId(id) },
      {
        $unset: { courseId: "" },
        $set: { status: "draft", updatedAt: new Date() },
      },
    );

    await coursesCollection.deleteOne({ _id: new ObjectId(id) });

    return Response.json(
      {
        success: true,
        message: "Curso eliminado con éxito",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error al eliminar el curso:", error);
    return Response.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
