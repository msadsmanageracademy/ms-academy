// @vitest-environment jsdom
// 3.4: navigation landmarks and dashboard rows.
import { expectNoA11yViolations } from "./setup.jsx";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminClassRow from "@/app/dashboard/classes/_components/AdminClassRow";
import Navbar from "@/views/components/layout/Navbar";
import Sidebar from "@/app/dashboard/Sidebar";
import StudentClassRow from "@/app/dashboard/classes/_components/StudentClassRow";

vi.mock("@/providers/NotificationProvider", () => ({
  useNotifications: () => ({ unreadCount: 3, incrementCount: () => {} }),
}));

const asAdmin = () => {
  globalThis.__testClientSession = { user: { id: "a1", name: "Admin", role: "admin" } };
};

describe("navigation", () => {
  it("Navbar: named landmark, current page and an unread count in words", async () => {
    asAdmin();
    globalThis.__testPathname = "/content";
    const { container } = render(<Navbar />);
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Notificaciones (3 sin leer)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "MS Academy, inicio" })).toBeTruthy();
    expect(container.querySelector('[aria-current="page"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir menú" }).getAttribute("aria-expanded")).toBe("false");
    await expectNoA11yViolations(container);
  });

  it("Sidebar: logout is a real button", async () => {
    asAdmin();
    globalThis.__testPathname = "/dashboard/classes";
    const { container } = render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "Panel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

describe("dashboard rows", () => {
  const cls = {
    _id: "c1",
    title: "Clase de prueba",
    start_date: new Date(Date.now() + 86400000).toISOString(),
    duration: 60,
    price: 0,
    status: "draft",
    participantsCount: 0,
    max_participants: null,
  };
  const table = (row) => (
    <table>
      <tbody>{row}</tbody>
    </table>
  );
  const noop = () => {};

  it("every admin action has an accessible name", async () => {
    const { container } = render(
      table(
        <AdminClassRow
          classItem={cls}
          hasCalendarAccess
          isAddingToCalendar={false}
          onAddToCalendar={noop}
          onConnectCalendar={noop}
          onDelete={noop}
          onLink={noop}
          onToggleStatus={noop}
          onUnlink={noop}
        />,
      ),
    );
    for (const name of ["Ver detalles", "Vincular a curso", "Publicar", "Eliminar", "Agregar"]) {
      expect(screen.getByRole(name === "Ver detalles" ? "link" : "button", { name })).toBeTruthy();
    }
    await expectNoA11yViolations(container);
  });

  it("student row actions are named, including disabled ones", async () => {
    const { container } = render(
      table(<StudentClassRow classItem={{ ...cls, status: "published" }} onReview={noop} onUnenroll={noop} />),
    );
    expect(screen.getByRole("button", { name: "Disponible al finalizar la clase" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar inscripción" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});

describe("SkipLink", () => {
  it("jumps to the dashboard content when present, otherwise to <main>", async () => {
    const { default: SkipLink } = await import("@/views/components/layout/SkipLink");
    // jsdom has no layout: scrolling is a no-op here
    Element.prototype.scrollIntoView = () => {};

    const { unmount } = render(
      <>
        <SkipLink />
        <main id="main-content" tabIndex={-1}>
          <nav aria-label="Panel">
            <a href="/dashboard">Inicio</a>
          </nav>
          <div data-skip-target tabIndex={-1}>
            Contenido del dashboard
          </div>
        </main>
      </>,
    );
    screen.getByRole("link", { name: "Saltar al contenido" }).click();
    expect(document.activeElement.textContent).toBe("Contenido del dashboard");
    unmount();

    render(
      <>
        <SkipLink />
        <main id="main-content" tabIndex={-1}>
          Página pública
        </main>
      </>,
    );
    screen.getByRole("link", { name: "Saltar al contenido" }).click();
    expect(document.activeElement.id).toBe("main-content");
  });
});
