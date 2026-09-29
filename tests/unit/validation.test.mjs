import { describe, expect, it } from "vitest";
import {
  ClassFormSchema,
  EditAccountFormSchema,
  RegisterFormSchema,
  ReviewFormSchema,
} from "@/utils/validation";

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

describe("ReviewFormSchema", () => {
  it.each([0, 6, 3.5])("rejects rating %s", (rating) => {
    expect(ReviewFormSchema.safeParse({ rating }).success).toBe(false);
  });

  it("limits the comment to 500 characters", () => {
    expect(ReviewFormSchema.safeParse({ rating: 5, comment: "a".repeat(501) }).success).toBe(false);
  });
});
