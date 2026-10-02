// @vitest-environment jsdom
// 3.5: table search + pagination, payment instructions and testimonials.
import { expectNoA11yViolations } from "./setup.jsx";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "@/views/components/ui/Pagination";
import PaymentInstructions from "@/views/components/ui/PaymentInstructions";
import TableSearch from "@/views/components/ui/TableSearch";
import Testimonials from "@/views/sections/pages/home/Testimonials";
import { useTableControls } from "@/hooks/useTableControls";

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
  it("lists the pending courses with the configured instructions", async () => {
    const { container } = render(<PaymentInstructions courses={[{ _id: "c1", title: "Meta Ads", price: 1000 }]} />);
    expect(screen.getByRole("region", { name: "Pago pendiente" })).toBeTruthy();
    expect(screen.getByText("Meta Ads")).toBeTruthy();
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
    await expectNoA11yViolations(container);
    unmount();

    expect(render(<Testimonials reviews={[]} />).container.innerHTML).toBe("");
  });
});
