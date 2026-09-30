import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { NotificationDBSchema } from "@/models/schemas";
import { NOTIFICATION_TEMPLATES, displayName } from "@/server/notifications/catalog";
import { buildNotifications } from "@/server/notifications";

const SAMPLE_VARS = {
  classTitle: "Clase A",
  courseTitle: "Curso B",
  user: { first_name: "Ana", last_name: "Pérez" },
  date: "martes 30 de septiembre de 2026 a las 18:30",
  published: true,
  name: "Juan",
  email: "juan@example.test",
  subject: "Consulta",
};

describe("notification catalog", () => {
  const allowedTypes = NotificationDBSchema.shape.type.options;

  it.each(Object.entries(NOTIFICATION_TEMPLATES))(
    "%s: stored type is part of the notification schema",
    (_key, template) => {
      expect(allowedTypes).toContain(template.type);
    },
  );

  it.each(Object.entries(NOTIFICATION_TEMPLATES))(
    "%s: builds a non-empty title and message without undefined values",
    (_key, template) => {
      const message = template.message(SAMPLE_VARS);
      expect(template.title.length).toBeGreaterThan(0);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain("undefined");
    },
  );

  it("keeps the exact user-facing texts", () => {
    expect(NOTIFICATION_TEMPLATES["class.enrolled"].message(SAMPLE_VARS)).toBe(
      'Te has inscrito en la clase "Clase A"',
    );
    expect(NOTIFICATION_TEMPLATES["class.status_changed"].message({ classTitle: "X", published: false })).toBe(
      'La clase "X" fue archivada',
    );
  });
});

describe("displayName", () => {
  it("joins first and last name without extra spaces", () => {
    expect(displayName({ first_name: "Ana", last_name: "Pérez" })).toBe("Ana Pérez");
    expect(displayName({ first_name: "Ana" })).toBe("Ana");
  });

  it("uses the fallback when there is no name", () => {
    expect(displayName(null)).toBe("Un usuario");
    expect(displayName({}, "un usuario")).toBe("un usuario");
  });
});

describe("buildNotifications", () => {
  const classId = new ObjectId();

  it("creates one document per recipient and ignores empty ones", () => {
    const a = new ObjectId();
    const docs = buildNotifications("class.updated", {
      to: [a, null, undefined, a.toString()],
      vars: { classTitle: "Clase A" },
      relatedId: classId,
    });
    expect(docs).toHaveLength(2);
    expect(docs.every((d) => d.userId instanceof ObjectId)).toBe(true);
    expect(docs[0]).toMatchObject({
      type: "class.updated",
      title: "Clase actualizada",
      message: 'La clase "Clase A" ha sido actualizada',
      relatedType: "class",
      read: false,
    });
    expect(docs[0].relatedId.equals(classId)).toBe(true);
    expect(docs[0].createdAt).toBeInstanceOf(Date);
  });

  it("maps template variants to the stored type", () => {
    const [doc] = buildNotifications("class.removed_by_admin.archived", {
      to: new ObjectId(),
      vars: { classTitle: "Clase A" },
    });
    expect(doc.type).toBe("class.removed_by_admin");
    expect(doc.message).toContain("porque fue archivada");
  });

  it("infers relatedType from the template prefix unless given", () => {
    const to = new ObjectId();
    expect(buildNotifications("course.unenrolled", { to, vars: { courseTitle: "C" } })[0].relatedType).toBe("course");
    expect(buildNotifications("contact.message", { to, vars: SAMPLE_VARS })[0].relatedType).toBe("contact");
  });

  it("returns nothing when there are no recipients", () => {
    expect(buildNotifications("class.updated", { to: [], vars: { classTitle: "X" } })).toEqual([]);
  });

  it("fails loudly on unknown templates", () => {
    expect(() => buildNotifications("class.nope", { to: new ObjectId() })).toThrow(/Unknown notification template/);
  });
});
