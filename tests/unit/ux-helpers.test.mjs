// 3.5: safe redirects after login and accent-insensitive search.
import { describe, expect, it } from "vitest";
import { loginUrl, safeCallbackUrl } from "@/utils/redirects";
import { normalize } from "@/hooks/useTableControls";

describe("safeCallbackUrl", () => {
  it.each([
    ["/content/courses/abc", "/content/courses/abc"],
    ["/dashboard/classes?x=1", "/dashboard/classes?x=1"],
  ])("keeps same-site path %s", (value, expected) => {
    expect(safeCallbackUrl(value)).toBe(expected);
  });

  it.each([["https://evil.test"], ["//evil.test"], ["/\\evil.test"], ["javascript:alert(1)"], [""], [null], [undefined]])(
    "falls back to the dashboard for %s",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/dashboard");
    },
  );

  it("loginUrl encodes the destination", () => {
    expect(loginUrl("/content/courses/1?a=b")).toBe("/login?callbackUrl=%2Fcontent%2Fcourses%2F1%3Fa%3Db");
  });
});

describe("normalize", () => {
  it("ignores case and accents", () => {
    expect(normalize("Clase BÁSICA de Publicación")).toBe("clase basica de publicacion");
    expect(normalize(null)).toBe("");
  });
});
