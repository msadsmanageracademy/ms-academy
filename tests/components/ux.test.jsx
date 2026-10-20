// @vitest-environment jsdom
// 3.5: table search + pagination, payment instructions and testimonials; "Mis clases" with
// the edition ("Curso · Septiembre 2030") and payment status of each course class.
import { expectNoA11yViolations } from "./setup.jsx";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "@/views/components/ui/Pagination";
import PaymentInstructions from "@/views/components/ui/PaymentInstructions";
import StudentClassesView from "@/app/dashboard/classes/_components/StudentClassesView";
import TableSearch from "@/views/components/ui/TableSearch";
import Testimonials from "@/views/sections/pages/home/Testimonials";
import { useTableControls } from "@/hooks/useTableControls";

vi.mock("@/server/actions/classes", () => ({ leaveClassAction: vi.fn() }));
vi.mock("@/providers/NotificationProvider", () => ({
  useNotifications: () => ({ unreadCount: 0, incrementCount: vi.fn() }),
}));

const items = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, title: i === 4 ? "Publicación avanzada" : `Clase ${i + 1}` }));
const fields = (item) => [item.title];

const Table = () => {
  const table = useTableControls(items, { fields, pageSize: 10 });
  return (
    <>
      <TableSearch
        filteredCount={table.filteredCount}
        label="Buscar clases"
        totalCount={table.totalCount}
        value={table.query}
        onChange={table.setQuery}
      />
      <ul>
        {table.pageItems.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
      <Pagination currentPage={table.page} totalPages={table.totalPages} onPageChange={table.setPage} />
    </>
  );
};

describe("table search + pagination", () => {
  it("pages of 10, accent-insensitive search that goes back to page 1", async () => {
    const user = userEvent.setup();
    const { container } = render(<Table />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Página 3" }));
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Clase 21", "Clase 22", "Clase 23"]);

    await user.type(screen.getByRole("searchbox", { name: "Buscar clases" }), "publicacion");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Publicación avanzada"]);
    expect(screen.getByText("1 de 23")).toBeTruthy();
    // One page of results: no pagination
    expect(screen.queryByRole("navigation", { name: "Paginación" })).toBeNull();
    await expectNoA11yViolations(container);
  });
});

describe("PaymentInstructions", () => {
  it("lists the pending editions with the configured instructions", async () => {
    const { container } = render(
      <PaymentInstructions courses={[{ _id: "e1", title: "Meta Ads · Septiembre 2030", price: 1000 }]} />,
    );
    expect(screen.getByRole("region", { name: "Pago pendiente" })).toBeTruthy();
    expect(screen.getByText("Meta Ads · Septiembre 2030")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir a Contacto" }).getAttribute("href")).toBe("/contact");
    await expectNoA11yViolations(container);
  });

  it("renders nothing without pending courses", () => {
    const { container } = render(<PaymentInstructions courses={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Testimonials", () => {
  it("shows real reviews and hides the section without them", async () => {
    const { container, unmount } = render(
      <Testimonials reviews={[{ _id: "r1", rating: 5, comment: "Muy bueno", firstName: "Ana", aboutTitle: "Meta Ads" }]} />,
    );
    expect(screen.getByRole("region", { name: "Lo que dicen mis alumnos" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "5 de 5 estrellas" })).toBeTruthy();
    // The course title (edition reviews carry their course through listFeaturedReviews)
    expect(screen.getByText("Meta Ads")).toBeTruthy();
    await expectNoA11yViolations(container);
    unmount();

    expect(render(<Testimonials reviews={[]} />).container.innerHTML).toBe("");
  });
});

describe("StudentClassesView (Mis clases)", () => {
  const future = "2030-09-17T22:00:00.000Z";
  const CLASSES = [
    {
      _id: "s1",
      title: "Clase suelta",
      price: 0,
      duration: 60,
      start_date: future,
      status: "published",
      googleEventId: "g1",
      googleMeetLink: "https://meet.example/s1",
    },
    {
      _id: "p1",
      title: "Clase paga",
      editionId: "e2",
      courseId: "c1",
      courseTitle: "Meta Ads",
      editionLabel: "Septiembre 2030",
      userEditionPaymentStatus: "paid",
      price: 0,
      duration: 90,
      start_date: future,
      status: "enrolled",
      googleEventId: "g2",
      googleMeetLink: "https://meet.example/p1",
      recording_url: "https://video.example/p1",
      resources: [{ title: "Guía", url: "https://docs.example/guia" }],
    },
    // Restricted fields are stripped on the server until the edition is paid
    {
      _id: "q1",
      title: "Clase pendiente",
      editionId: "e9",
      courseId: "c2",
      courseTitle: "Google Ads",
      editionLabel: "Octubre 2030",
      userEditionPaymentStatus: "pending",
      price: 0,
      duration: 60,
      start_date: future,
      status: "enrolled",
    },
  ];
  const row = (title) => within(screen.getByRole("row", { name: new RegExp(title) }));

  it("shows each course class as 'Curso · <Mes Año>' with its payment status, never its number", async () => {
    const { container } = render(<StudentClassesView classes={CLASSES} reviews={{}} />);
    const paid = row("Clase paga");
    expect(paid.getByText("Meta Ads · Septiembre 2030")).toBeTruthy();
    expect(paid.getByText("Pagado")).toBeTruthy();
    expect(paid.getByText("Incluido en el curso")).toBeTruthy();
    expect(paid.getByRole("link", { name: "Abrir Google Meet" }).getAttribute("href")).toBe("https://meet.example/p1");
    expect(paid.getByRole("link", { name: "Grabación" })).toBeTruthy();
    expect(paid.getByRole("link", { name: "Guía" })).toBeTruthy();
    // Edition classes are reviewed through the edition and left through the course
    expect(paid.queryByRole("button", { name: /reseña|Disponible al finalizar/ })).toBeNull();
    expect(paid.getByRole("button", { name: "La inscripción se gestiona desde el curso" }).disabled).toBe(true);

    const pending = row("Clase pendiente");
    expect(pending.getByText("Google Ads · Octubre 2030")).toBeTruthy();
    expect(pending.getByText("Pago pendiente")).toBeTruthy();
    expect(pending.getByText("🔒 Pago pendiente")).toBeTruthy();
    expect(pending.queryByRole("link", { name: "Abrir Google Meet" })).toBeNull();

    const standalone = row("Clase suelta");
    expect(standalone.getByText("Gratis")).toBeTruthy();
    expect(standalone.queryByText(/Edición/)).toBeNull();
    expect(standalone.getByRole("button", { name: "Disponible al finalizar la clase" })).toBeTruthy();
    expect(standalone.getByRole("button", { name: "Cancelar inscripción" }).disabled).toBe(false);
    expect(container.textContent).not.toMatch(/Edición \d/);
    await expectNoA11yViolations(container);
  });

  it("searches by edition name (its month) and filters by course", async () => {
    const user = userEvent.setup();
    render(<StudentClassesView classes={CLASSES} reviews={{}} />);
    const titles = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((r) => r.cells[0].textContent);

    await user.type(screen.getByRole("searchbox", { name: "Buscar clases" }), "septiembre");
    expect(titles()).toEqual(["Clase paga"]);
    await user.clear(screen.getByRole("searchbox", { name: "Buscar clases" }));

    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por curso" }), "c2");
    expect(titles()).toEqual(["Clase pendiente"]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por curso" }), "none");
    expect(titles()).toEqual(["Clase suelta"]);
  });
});
