// Pure course/edition rules (src/server/courses/rules.js). Properties use the seeded PRNG.
import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import {
  archiveCourseError,
  copyClassForEdition,
  deleteCourseError,
  deleteEditionError,
  editionEditError,
  publishEditionError,
  reviewEligibilityError,
  unpublishEditionError,
} from "@/server/courses/rules";
import { RESTRICTED_CLASS_FIELDS } from "@/server/classes/service";
import { TIME_STATUSES, classGen, dateAround, forAll, gen } from "../support/random.mjs";

const NOW = new Date("2026-06-15T15:00:00Z");
const DAY = 86400000;

describe("archiveCourseError", () => {
  it("blocks archiving while an edition is published and upcoming or in progress", () => {
    expect(archiveCourseError({ editions: [] })).toBeNull();
    expect(archiveCourseError({ editions: [{ status: "published", timeStatus: "completed" }] })).toBeNull();
    expect(archiveCourseError({ editions: [{ status: "draft", timeStatus: null }] })).toBeNull();
    expect(archiveCourseError({ editions: [{ status: "published", timeStatus: "upcoming" }] })).toBe(
      "No se puede archivar un curso con ediciones publicadas próximas o en curso",
    );
  });

  it("Feature: course-editions, Property 9: Regla de archivado", async () => {
    const editionGen = gen.record({
      status: gen.pick(["draft", "published"]),
      timeStatus: gen.pick([...TIME_STATUSES, null]),
    });
    await forAll(gen.array(editionGen, { max: 8 }), (editions) => {
      const live = editions.some(
        (e) => e.status === "published" && (e.timeStatus === "upcoming" || e.timeStatus === "in-progress"),
      );
      const error = archiveCourseError({ editions });
      if (live) expect(error).toEqual(expect.any(String));
      else expect(error).toBeNull();
    });
  });
});

describe("copyClassForEdition", () => {
  it("Feature: course-editions, Property 10: Copia de clases sin fechas", async () => {
    const editionId = new ObjectId();
    const adminId = new ObjectId();
    await forAll(classGen({ now: NOW }), (cls) => {
      const original = { ...cls };
      const copy = copyClassForEdition(cls, { editionId, adminId, now: NOW });

      expect(copy.editionId).toBe(editionId);
      expect(copy).toMatchObject({ start_date: null, status: "enrolled", max_participants: null });
      expect(copy).not.toHaveProperty("_id");
      expect(copy).not.toHaveProperty("participants");
      expect(copy).not.toHaveProperty("courseId");
      for (const field of RESTRICTED_CLASS_FIELDS) expect(copy).not.toHaveProperty(field);
      expect(copy).toMatchObject({
        title: cls.title,
        short_description: cls.short_description,
        duration: cls.duration,
        createdBy: adminId,
        createdAt: NOW,
        updatedAt: NOW,
      });
      // The original document is not modified
      expect(cls).toEqual(original);
    });
  });
});

describe("publishEditionError", () => {
  const future = new Date(NOW.getTime() + DAY);
  const past = new Date(NOW.getTime() - DAY);

  it("reports the first unmet condition", () => {
    const at = (start_date) => ({ start_date });
    expect(publishEditionError({ courseStatus: "archived", classes: [], now: NOW })).toBe(
      "No se puede publicar una edición de un curso archivado",
    );
    expect(publishEditionError({ courseStatus: "active", classes: [], now: NOW })).toMatch(/sin clases asignadas/);
    expect(publishEditionError({ courseStatus: "active", classes: [at(null), at(undefined), at(future)], now: NOW }))
      .toBe("No se puede publicar: 2 clase(s) no tienen fecha asignada");
    expect(publishEditionError({ courseStatus: "active", classes: [at(future), at(past)], now: NOW })).toBe(
      "No se puede publicar una edición cuya primera clase ya comenzó",
    );
    expect(publishEditionError({ courseStatus: "active", classes: [at(future)], now: NOW })).toBeNull();
  });

  it("Feature: course-editions, Property 11: Regla de publicación", async () => {
    const classes = gen.array(
      gen.record({ start_date: gen.oneOf(dateAround(NOW, 30), dateAround(NOW, 30), gen.constant(null)) }),
      { max: 6 },
    );
    await forAll(
      gen.record({ courseStatus: gen.pick(["active", "archived"]), classes, offsetMinutes: gen.int(-600, 600) }),
      ({ courseStatus, classes, offsetMinutes }) => {
        const now = new Date(NOW.getTime() + offsetMinutes * 60000);
        const missing = classes.filter((c) => c.start_date === null).length;
        const earliest = Math.min(...classes.filter((c) => c.start_date).map((c) => c.start_date.getTime()));

        let expected = null;
        if (courseStatus !== "active") expected = "No se puede publicar una edición de un curso archivado";
        else if (classes.length === 0) {
          expected = "No se puede publicar una edición sin clases asignadas. Asignale al menos una clase primero.";
        } else if (missing > 0) expected = `No se puede publicar: ${missing} clase(s) no tienen fecha asignada`;
        else if (!(earliest > now.getTime())) {
          expected = "No se puede publicar una edición cuya primera clase ya comenzó";
        }
        expect(publishEditionError({ courseStatus, classes, now })).toBe(expected);
      },
    );
  });
});

describe("reviewEligibilityError", () => {
  it("Feature: course-editions, Property 15: Elegibilidad para reseñar", async () => {
    await forAll(
      gen.record({ paid: gen.bool(), timeStatus: gen.pick([...TIME_STATUSES, null, undefined]) }),
      ({ paid, timeStatus }) => {
        const error = reviewEligibilityError({ paid, timeStatus });
        if (paid && timeStatus === "completed") expect(error).toBeNull();
        else expect(error).toEqual(expect.any(String));
      },
    );
    expect(reviewEligibilityError({ paid: false, timeStatus: "completed" })).toBe(
      "Solo inscriptos con pago confirmado pueden dejar una reseña",
    );
    expect(reviewEligibilityError({ paid: true, timeStatus: "in-progress" })).toBe(
      "Solo podés dejar una reseña una vez que la edición haya finalizado",
    );
  });
});

describe("other edition and course rules", () => {
  it("unpublishing is blocked only while in progress", () => {
    expect(unpublishEditionError({ timeStatus: "in-progress" })).toMatch(/en curso/);
    for (const timeStatus of ["upcoming", "completed", null]) {
      expect(unpublishEditionError({ timeStatus })).toBeNull();
    }
  });

  it("courses with enrollees are archived instead of deleted", () => {
    expect(deleteCourseError({ enrollmentCount: 0 })).toBeNull();
    expect(deleteCourseError({ enrollmentCount: 1 })).toBe(
      "No se puede eliminar un curso que tiene inscriptos. Archivalo en su lugar.",
    );
  });

  it("published editions can be neither deleted nor have their price or capacity edited", () => {
    expect(deleteEditionError({ status: "draft" })).toBeNull();
    expect(deleteEditionError({ status: "published" })).toMatch(/Despublicala primero/);
    expect(editionEditError({ status: "draft" })).toBeNull();
    expect(editionEditError({ status: "published" })).toMatch(/precio ni el cupo/);
  });
});
