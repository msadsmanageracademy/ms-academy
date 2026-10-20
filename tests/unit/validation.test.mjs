import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import {
  ClassFormSchema,
  CourseCreateSchema,
  CourseStatusSchema,
  EditAccountFormSchema,
  EditionFormSchema,
  EditionLinkSchema,
  RegisterFormSchema,
  ReviewFormSchema,
  ReviewPageQuerySchema,
} from "@/utils/validation";
import { prepareEditionForDB } from "@/models/schemas";

describe("RegisterFormSchema", () => {
  const valid = { email: "ana@example.test", password: "Segura#123" };

  it("accepts a valid registration", () => {
    expect(RegisterFormSchema.safeParse(valid).success).toBe(true);
  });

  it("strict mode rejects `role` (the role cannot be chosen)", () => {
    expect(RegisterFormSchema.strict().safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  it("requires a strong password", () => {
    expect(RegisterFormSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });
});

describe("EditAccountFormSchema", () => {
  it("strict mode rejects non-editable fields", () => {
    const strict = EditAccountFormSchema.strict();
    expect(strict.safeParse({ first_name: "Ana" }).success).toBe(true);
    expect(strict.safeParse({ first_name: "Ana", role: "admin" }).success).toBe(false);
    expect(strict.safeParse({ email: "other@example.test" }).success).toBe(false);
  });
});

describe("ClassFormSchema", () => {
  const base = {
    title: "Class",
    short_description: "Long enough description",
    duration: 60,
    price: 0,
  };

  it("rejects past dates", () => {
    const past = { ...base, start_date: new Date(Date.now() - 60000) };
    expect(ClassFormSchema.safeParse(past).success).toBe(false);
  });

  it("accepts future dates", () => {
    const future = { ...base, start_date: new Date(Date.now() + 86400000) };
    expect(ClassFormSchema.safeParse(future).success).toBe(true);
  });
});

describe("CourseCreateSchema / EditionFormSchema", () => {
  const valid = {
    title: "Meta Ads",
    short_description: "Campañas desde cero",
    full_description: "Todo lo necesario para campañas rentables",
    price: 15000,
    max_participants: 20,
  };

  it("accepts the course content plus the price and capacity of Edition 1", () => {
    expect(CourseCreateSchema.parse(valid)).toEqual(valid);
  });

  it("capacity 0 is valid (no limit) and is stored as null", () => {
    expect(CourseCreateSchema.parse({ ...valid, max_participants: 0 }).max_participants).toBe(0);
    expect(EditionFormSchema.parse({ price: 0 })).toEqual({ price: 0, max_participants: null });
    const courseId = new ObjectId();
    const userId = new ObjectId();
    const edition = prepareEditionForDB({ courseId, price: 100, max_participants: 0 }, userId);
    expect(edition).toMatchObject({ courseId, price: 100, max_participants: null, status: "draft" });
    expect(edition).not.toHaveProperty("number");
    expect(edition.createdBy).toBe(userId);
  });

  it("rejects negative values and short content with the form messages", () => {
    const issues = (input) => CourseCreateSchema.safeParse(input).error?.issues.map((i) => i.message) ?? [];
    expect(issues({ ...valid, price: -1 })).toEqual(["Debe ingresar 0 o mayor"]);
    expect(issues({ ...valid, max_participants: -3 })).toEqual(["Debe ingresar 0 o mayor"]);
    expect(issues({ ...valid, title: "ab" })).toEqual(["Debe contener al menos 3 caracteres"]);
    expect(EditionFormSchema.safeParse({ price: "100" }).success).toBe(false);
  });
});

describe("CourseStatusSchema / EditionLinkSchema", () => {
  it("only accepts active and archived", () => {
    expect(CourseStatusSchema.parse({ status: "archived" })).toEqual({ status: "archived" });
    for (const status of ["published", "draft", "", undefined]) {
      const parsed = CourseStatusSchema.safeParse({ status });
      expect(parsed.success).toBe(false);
      expect(parsed.error.issues[0].message).toBe("Estado inválido");
    }
  });

  it("requires an editionId", () => {
    expect(EditionLinkSchema.safeParse({ editionId: "" }).error.issues[0].message).toBe("editionId inválido");
    expect(EditionLinkSchema.safeParse({}).error.issues[0].message).toBe("editionId inválido");
  });
});

describe("ReviewPageQuerySchema", () => {
  const id = new ObjectId().toString();

  it("parses a valid query string", () => {
    expect(ReviewPageQuerySchema.parse({ page: "3", edition: id })).toEqual({ page: 3, edition: id });
    expect(ReviewPageQuerySchema.parse({})).toEqual({ page: 1, edition: undefined });
  });

  it.each([["0"], ["-2"], ["1.5"], ["abc"], [""], [["2", "3"]]])("falls back to page 1 for %j", (page) => {
    expect(ReviewPageQuerySchema.parse({ page }).page).toBe(1);
  });

  it.each([["not-an-id"], ["123"], [`${id}x`], [["a", "b"]]])("drops the edition filter %j", (edition) => {
    expect(ReviewPageQuerySchema.parse({ edition }).edition).toBeUndefined();
  });
});

describe("ReviewFormSchema", () => {
  it.each([0, 6, 3.5])("rejects rating %s", (rating) => {
    expect(ReviewFormSchema.safeParse({ rating }).success).toBe(false);
  });

  it("limits the comment to 500 characters", () => {
    expect(ReviewFormSchema.safeParse({ rating: 5, comment: "a".repeat(501) }).success).toBe(false);
  });
});
