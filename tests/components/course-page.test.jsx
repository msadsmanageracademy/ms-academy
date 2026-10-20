// @vitest-environment jsdom
// Admin course page /dashboard/courses/[courseId]: course data and lifecycle, course-wide
// metrics, the paginated editions table and the reviews (URL pagination + edition filter).
import { expectNoA11yViolations, router } from "./setup.jsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoursePageView from "@/app/dashboard/courses/[courseId]/_components/CoursePageView";
import { reviewsQuery } from "@/app/dashboard/courses/[courseId]/_components/CourseReviewsSection";
import { confirmCourseStatus, confirmDeleteItem } from "@/utils/alerts";

const { createEditionAction, deleteCourseAction, setCourseStatusAction } = vi.hoisted(() => ({
  createEditionAction: vi.fn(async () => ({ ok: true, data: { _id: "e13" } })),
  deleteCourseAction: vi.fn(async () => ({ ok: true })),
  setCourseStatusAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/server/actions/courses", () => ({ createEditionAction, deleteCourseAction, setCourseStatusAction }));
vi.mock("@/utils/alerts", () => ({
  confirmCourseStatus: vi.fn(async () => ({ isConfirmed: true })),
  confirmDeleteItem: vi.fn(async () => ({ isConfirmed: true })),
  toastLoading: vi.fn(),
  closeLoading: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const PATH = "/dashboard/courses/c1";

// Editions 1–11 (by date) finished and published, the 12th a draft without dates
const edition = (number) => {
  const draft = number === 12;
  return {
    _id: `e${number}`,
    adminNumber: number,
    label: draft ? "Sin fecha" : `Marzo 20${10 + number}`,
    status: draft ? "draft" : "published",
    timeStatus: draft ? null : "completed",
    price: draft ? 0 : 20000 + number * 1000,
    max_participants: number === 5 ? 20 : null,
    start_date: draft ? null : `20${10 + number}-03-10T22:00:00.000Z`,
    end_date: draft ? null : `20${10 + number}-04-10T23:00:00.000Z`,
    amount_of_classes: 4,
    enrollmentCount: draft ? 0 : 6,
    paidCount: draft ? 0 : number === 1 ? 1 : 5,
    avgRating: draft ? null : number === 5 ? 3.5 : 4.5,
    reviewCount: draft ? 0 : number === 5 ? 2 : 1,
  };
};
const EDITIONS = Array.from({ length: 12 }, (_, i) => edition(i + 1));

const course = (overrides) => ({
  _id: "c1",
  title: "Meta Ads desde cero",
  short_description: "Aprendé a crear campañas rentables",
  full_description: "Todo el recorrido de Meta Ads",
  status: "active",
  createdAt: "2024-01-15T12:00:00.000Z",
  editions: EDITIONS,
  metrics: {
    editionCount: 12,
    timesTaught: 11,
    enrolledCount: 66,
    paidCount: 51,
    estimatedRevenue: 1625000,
    avgRating: 4.42,
    reviewCount: 12,
    classesPerEdition: 4,
  },
  ...overrides,
});

const review = (i, n) => ({
  _id: `r${i}`,
  rating: 4,
  comment: `Comentario ${i}`,
  firstName: `Alumno ${i}`,
  createdAt: "2030-01-01T00:00:00.000Z",
  editionId: `e${n}`,
  editionLabel: edition(n).label,
});
const REVIEWS = { items: [review(1, 5), review(2, 3)], page: 2, totalPages: 3, total: 22 };

const section = (name) => within(screen.getByRole("region", { name }));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__testPathname = PATH;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ message: "Curso actualizado", data: {} }) })),
  );
});

afterEach(() => {
  delete globalThis.__testPathname;
  vi.unstubAllGlobals();
});

describe("CoursePageView: course data and metrics", () => {
  it("shows the course content and the figures of all its editions", async () => {
    const { container } = render(<CoursePageView course={course()} reviews={REVIEWS} />);
    expect(screen.getByRole("heading", { level: 1, name: "Meta Ads desde cero" })).toBeTruthy();
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación" }));
    expect(breadcrumb.getByRole("link", { name: "Cursos" }).getAttribute("href")).toBe("/dashboard/courses");

    const info = section("Información del curso");
    expect(info.getByText("Activo")).toBeTruthy();
    expect(info.getByText("Aprendé a crear campañas rentables")).toBeTruthy();
    expect(info.getByText("Todo el recorrido de Meta Ads")).toBeTruthy();
    expect(info.getByRole("button", { name: "Editar curso" })).toBeTruthy();
    expect(info.getByRole("button", { name: "Archivar curso" })).toBeTruthy();

    const metrics = section("Métricas del curso");
    const stat = (label) => metrics.getByText(label).nextElementSibling.textContent;
    expect(stat("Ediciones")).toBe("12");
    expect(stat("Veces dictado")).toBe("11");
    expect(stat("Alumnos inscriptos")).toBe("66");
    expect(stat("Alumnos pagos")).toBe("51");
    expect(stat("Ingreso estimado")).toBe("ARS 1.625.000");
    expect(stat("Clases por edición")).toBe("4");
    expect(stat("Promedio de reseñas")).toMatch(/4,42\s*\(12 reseñas\)/);
    await expectNoA11yViolations(container);
  });

  it("shows 'Sin reseñas' and ARS 0 for a course without reviews or payments", () => {
    const metrics = { ...course().metrics, avgRating: null, reviewCount: 0, estimatedRevenue: 0 };
    render(<CoursePageView course={course({ metrics })} reviews={{ items: [], page: 1, totalPages: 1, total: 0 }} />);
    const stats = section("Métricas del curso");
    expect(stats.getByText("Promedio de reseñas").nextElementSibling.textContent).toBe("Sin reseñas");
    expect(stats.getByText("Ingreso estimado").nextElementSibling.textContent).toBe("ARS 0");
  });

  it("archives an active course and reactivates an archived one", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CoursePageView course={course()} reviews={REVIEWS} />);
    await user.click(screen.getByRole("button", { name: "Archivar curso" }));
    await waitFor(() => expect(setCourseStatusAction).toHaveBeenCalledWith("c1", "archived"));
    expect(confirmCourseStatus).toHaveBeenCalledWith("archived", "Meta Ads desde cero");
    unmount();

    render(<CoursePageView course={course({ status: "archived" })} reviews={REVIEWS} />);
    expect(section("Información del curso").getByText("Archivado")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reactivar curso" }));
    await waitFor(() => expect(setCourseStatusAction).toHaveBeenLastCalledWith("c1", "active"));
  });

  it("can't archive while an edition is published and upcoming or in progress", async () => {
    const user = userEvent.setup();
    for (const timeStatus of ["upcoming", "in-progress"]) {
      const live = { ...edition(13), label: "Septiembre 2030", status: "published", timeStatus };
      const { unmount } = render(<CoursePageView course={course({ editions: [...EDITIONS, live] })} reviews={REVIEWS} />);
      const archive = screen.getByRole("button", { name: "Archivar curso" });
      expect(archive.disabled).toBe(true);
      expect(archive.getAttribute("title")).toBe(
        "No se puede archivar un curso con ediciones publicadas próximas o en curso",
      );
      await user.click(archive);
      unmount();
    }
    expect(setCourseStatusAction).not.toHaveBeenCalled();

    // An archived course can always be reactivated
    const live = { ...edition(13), status: "published", timeStatus: "upcoming" };
    render(<CoursePageView course={course({ status: "archived", editions: [live] })} reviews={REVIEWS} />);
    expect(screen.getByRole("button", { name: "Reactivar curso" }).disabled).toBe(false);
  });

  it("only deletes a course without enrollments, then goes back to the list", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CoursePageView course={course()} reviews={REVIEWS} />);
    const blocked = screen.getByRole("button", { name: "Tiene inscriptos: archivalo en su lugar" });
    expect(blocked.disabled).toBe(true);
    unmount();

    const empty = { ...course().metrics, enrolledCount: 0, paidCount: 0 };
    render(<CoursePageView course={course({ metrics: empty })} reviews={REVIEWS} />);
    await user.click(screen.getByRole("button", { name: "Eliminar curso" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/courses"));
    expect(confirmDeleteItem).toHaveBeenCalledWith("curso", "Meta Ads desde cero");
    expect(deleteCourseAction).toHaveBeenCalledWith("c1");
  });

  it("edits the course content in place and refreshes the page", async () => {
    const user = userEvent.setup();
    const { container } = render(<CoursePageView course={course()} reviews={REVIEWS} />);
    await user.click(screen.getByRole("button", { name: "Editar curso" }));

    const form = section("Editar curso");
    expect(form.getByLabelText("Título").value).toBe("Meta Ads desde cero");
    expect(form.queryByLabelText("Precio de la Edición 1")).toBeNull();
    await expectNoA11yViolations(container);
    await user.clear(form.getByLabelText("Título"));
    await user.type(form.getByLabelText("Título"), "Meta Ads avanzado");
    await user.click(form.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/courses/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body).title).toBe("Meta Ads avanzado");
    expect(screen.queryByRole("region", { name: "Editar curso" })).toBeNull();
    expect(screen.getByRole("region", { name: "Información del curso" })).toBeTruthy();
  });
});

describe("CoursePageView: editions table", () => {
  // The date label of each row (its link); the admin number is the muted line below it
  const rowHeaders = () =>
    within(screen.getByRole("table", { name: "Ediciones del curso" }))
      .getAllByRole("rowheader")
      .map((th) => th.querySelector("a").textContent);
  const rowOf = (table, label) => within(table.getByRole("link", { name: label }).closest("tr"));

  it("lists the editions chronologically last first, 10 per page, each row linked to its edition by id", async () => {
    const user = userEvent.setup();
    const { container } = render(<CoursePageView course={course()} reviews={REVIEWS} />);
    const table = within(screen.getByRole("table", { name: "Ediciones del curso" }));
    expect(table.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Edición",
      "Fechas",
      "Clases",
      "Precio",
      "Inscriptos",
      "Estado",
      "Reseñas",
      "Acciones",
    ]);
    expect(rowHeaders()).toHaveLength(10);
    expect(rowHeaders()[0]).toBe("Sin fecha");
    expect(rowHeaders()[9]).toBe("Marzo 2013");

    const draft = rowOf(table, "Sin fecha");
    expect(draft.getByRole("link", { name: "Sin fecha" }).getAttribute("href")).toBe(`${PATH}/editions/e12`);
    expect(draft.getByText("Edición 12 de 12")).toBeTruthy();
    expect(draft.getByText("Sin fechas")).toBeTruthy();
    expect(draft.getByText("Borrador")).toBeTruthy();
    expect(draft.getByText("Gratis")).toBeTruthy();
    expect(draft.getByText("Sin reseñas")).toBeTruthy();
    expect(draft.getByRole("link", { name: "Editar Sin fecha" }).getAttribute("href")).toBe(
      `${PATH}/editions/e12?edit=1`,
    );

    const fifth = rowOf(table, "Marzo 2015");
    expect(fifth.getByText("Edición 5 de 12")).toBeTruthy();
    expect(fifth.getByRole("link", { name: "Ver Marzo 2015" }).getAttribute("href")).toBe(`${PATH}/editions/e5`);
    expect(fifth.queryByRole("link", { name: "Editar Marzo 2015" })).toBeNull();
    expect(fifth.getByText("Publicada")).toBeTruthy();
    expect(fifth.getByText("Finalizada")).toBeTruthy();
    expect(fifth.getByText("6 / 20")).toBeTruthy();
    expect(fifth.getByText("5 pagos")).toBeTruthy();
    expect(fifth.getByText("ARS 25.000")).toBeTruthy();
    expect(fifth.getByText(/3,5 \(2\)/)).toBeTruthy();
    await expectNoA11yViolations(container);

    // Two paginations on the page (editions and reviews), each its own landmark
    expect(screen.getByRole("navigation", { name: "Paginación de reseñas" })).toBeTruthy();
    const editionsPages = within(screen.getByRole("navigation", { name: "Paginación de ediciones" }));
    await user.click(editionsPages.getByRole("button", { name: "Página 2" }));
    expect(rowHeaders()).toEqual(["Marzo 2012", "Marzo 2011"]);
    expect(screen.getByText("1 pago")).toBeTruthy();
  });

  it("'Nueva edición' creates a new edition and opens it by id", async () => {
    const user = userEvent.setup();
    render(<CoursePageView course={course()} reviews={REVIEWS} />);
    await user.click(screen.getByRole("button", { name: "Crear una nueva edición de este curso" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`${PATH}/editions/e13`));
    expect(createEditionAction).toHaveBeenCalledWith("c1");
  });

  it("shows an empty state for a course without editions", () => {
    const metrics = { ...course().metrics, editionCount: 0 };
    render(<CoursePageView course={course({ editions: [], metrics })} reviews={REVIEWS} />);
    expect(section("Ediciones").getByText("Este curso todavía no tiene ediciones.")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Ediciones del curso" })).toBeNull();
  });
});

describe("CoursePageView: reviews", () => {
  it("lists every edition's reviews with their edition and the course-wide summary", async () => {
    const { container } = render(<CoursePageView course={course()} reviews={REVIEWS} />);
    const reviews = section(/^Reseñas/);
    expect(reviews.getByRole("heading", { level: 2 }).textContent).toMatch(/4,42 \(12\)/);
    const list = within(reviews.getByRole("list"));
    expect(list.getByText("Comentario 1")).toBeTruthy();
    expect(list.getByText("Marzo 2015")).toBeTruthy();
    expect(list.getByText("Marzo 2013")).toBeTruthy();
    const filter = reviews.getByLabelText("Edición");
    expect(filter.value).toBe("");
    const options = within(filter).getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(13);
    // The filter names editions by date
    expect(options).toEqual(expect.arrayContaining(["Marzo 2015", "Sin fecha"]));
    expect(options.some((o) => /Edición \d/.test(o))).toBe(false);
    expect(reviews.getByRole("button", { name: "Página 2" }).getAttribute("aria-current")).toBe("page");
    await expectNoA11yViolations(container);
  });

  it("moves between pages through the URL", async () => {
    const user = userEvent.setup();
    render(<CoursePageView course={course()} reviews={REVIEWS} />);
    const reviews = section(/^Reseñas/);
    await user.click(reviews.getByRole("button", { name: "Página 3" }));
    expect(router.push).toHaveBeenLastCalledWith(`${PATH}?page=3`, { scroll: false });
    await user.click(reviews.getByRole("button", { name: "Página 1" }));
    expect(router.push).toHaveBeenLastCalledWith(PATH, { scroll: false });
  });

  it("changing the edition filter goes back to page 1", async () => {
    const user = userEvent.setup();
    render(<CoursePageView course={course()} reviews={REVIEWS} />);
    await user.selectOptions(section(/^Reseñas/).getByLabelText("Edición"), "e5");
    expect(router.push).toHaveBeenCalledWith(`${PATH}?edition=e5`, { scroll: false });
  });

  it("with a filter: that edition's summary, no edition labels, and the filter kept across pages", async () => {
    const user = userEvent.setup();
    const filtered = { items: [review(1, 5), review(3, 5)], page: 1, totalPages: 2, total: 12 };
    const { container } = render(
      <CoursePageView course={course()} reviewEditionId="e5" reviews={filtered} />,
    );
    const reviews = section(/^Reseñas/);
    expect(reviews.getByLabelText("Edición").value).toBe("e5");
    expect(reviews.getByRole("heading", { level: 2 }).textContent).toMatch(/3,5 \(2\)/);
    const list = within(reviews.getByRole("list"));
    expect(list.getAllByText(/^Comentario/)).toHaveLength(2);
    expect(list.queryByText("Marzo 2015")).toBeNull();
    await expectNoA11yViolations(container);

    await user.click(reviews.getByRole("button", { name: "Página siguiente" }));
    expect(router.push).toHaveBeenLastCalledWith(`${PATH}?page=2&edition=e5`, { scroll: false });
    await user.selectOptions(reviews.getByLabelText("Edición"), "");
    expect(router.push).toHaveBeenLastCalledWith(PATH, { scroll: false });
  });

  it("shows an empty message for an edition without reviews", () => {
    render(
      <CoursePageView
        course={course()}
        reviewEditionId="e12"
        reviews={{ items: [], page: 1, totalPages: 1, total: 0 }}
      />,
    );
    const reviews = section(/^Reseñas/);
    expect(reviews.getByText("Todavía no hay reseñas de esta edición.")).toBeTruthy();
    expect(reviews.queryByRole("navigation", { name: "Paginación de reseñas" })).toBeNull();
  });
});

describe("reviewsQuery", () => {
  it("leaves out page 1 and the 'every edition' filter", () => {
    expect(reviewsQuery({ page: 1, edition: "" })).toBe("");
    expect(reviewsQuery({ page: 1, edition: null })).toBe("");
    expect(reviewsQuery({ page: 4 })).toBe("?page=4");
    expect(reviewsQuery({ page: 1, edition: "e2" })).toBe("?edition=e2");
    expect(reviewsQuery({ page: 2, edition: "e2" })).toBe("?page=2&edition=e2");
  });
});
