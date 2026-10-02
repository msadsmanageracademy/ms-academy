// Shared setup for component tests (jsdom): Next.js / Auth.js mocks and an axe helper.
import axe from "axe-core";
import { afterEach, expect, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Lets React flush updates synchronously inside Testing Library's act()
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => cleanup());

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }) => (
    <a href={typeof href === "string" ? href : href?.pathname} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- test double of next/image
  default: ({ priority: _priority, ...props }) => <img {...props} />,
}));

export const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => globalThis.__testPathname ?? "/",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: globalThis.__testClientSession ?? null, status: "authenticated", update: vi.fn() }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

/**
 * Runs axe on a rendered container. Contrast is skipped: jsdom has no layout or
 * computed colors (contrast was checked against the palette separately).
 */
export async function expectNoA11yViolations(container) {
  const { violations } = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}
