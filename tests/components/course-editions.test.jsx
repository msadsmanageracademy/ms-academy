// @vitest-environment jsdom
// Courses and editions in /dashboard/courses: admin course cards (search, "Nueva
// edición", "Crear curso") and the student's editions ("Curso · Octubre 2030").
import { expectNoA11yViolations, router } from "./setup.jsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCoursesView from "@/app/dashboard/courses/_components/AdminCoursesView";
import CourseForm from "@/views/sections/pages/dashboard/courses/CourseForm";
import StudentCoursesView from "@/app/dashboard/courses/_components/StudentCoursesView";
import { formatDate } from "@/utils/dates";
import { toastError } from "@/utils/alerts";

const { createEditionAction, cancelEditionEnrollmentAction } = vi.hoisted(() => ({
  createEditionAction: vi.fn(async () => ({ ok: true, data: { _id: "new-edition" } })),
  cancelEditionEnrollmentAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/server/actions/courses", () => ({ createEditionAction, cancelEditionEnrollmentAction }));
vi.mock("@/utils/alerts", () => ({
  confirmUnenroll: vi.fn(async () => ({ isConfirmed: true })),
  toastLoading: vi.fn(),
  closeLoading: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const START = "2030-10-01T22:00:00.000Z";

const card = (overrides) => ({
  short_description: "Descripción del curso",
  status: "active",
  current: null,
  latest: null,
  lastDate: null,
  classesPerEdition: 0,
  editionCount: 1,
  timesTaught: 0,
  enrolledCount: 0,
  paidCount: 0,
  estimatedRevenue: 0,
  avgRating: null,
  reviewCount: 0,
  ...overrides,
});

const META = card({
  _id: "c-meta",
  title: "Meta Ads desde cero",
  short_description: "Aprendé a crear campañas rentables",
  current: { _id: "e3", adminNumber: 3, label: "Octubre 2030", status: "published", timeStatus: "upcoming", start_date: START },
  latest: { _id: "e3", adminNumber: 3, label: "Octubre 2030" },
  classesPerEdition: 4,
  editionCount: 3,
  timesTaught: 2,
  paidCount: 14,
  avgRating: 4.56,
  reviewCount: 9,
});
const ARCHIVED = card({
  _id: "c-old",
  title: "Email marketing",
  short_description: "Newsletters que convierten",
  status: "archived",
  latest: { _id: "e-old", adminNumber: 2, label: "Marzo 2025" },
  editionCount: 2,
  timesTaught: 2,
  paidCount: 1,
  avgRating: 5,
  reviewCount: 1,
});
const DRAFT = card({ _id: "c-new", title: "Analítica de campañas", short_description: "Medí lo que importa" });
const COURSES = [META, ARCHIVED, DRAFT];

const cardOf = (title) => screen.getByRole("article", { name: title });

let fetchMock;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: "Curso creado con éxito", data: {} }) }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminCoursesView (one card per course)", () => {
  it("shows status, current edition and course-wide figures on each card", async () => {
    const { container } = render(<AdminCoursesView courses={COURSES} />);
    expect(screen.getAllByRole("article")).toHaveLength(3);

    const meta = within(cardOf("Meta Ads desde cero"));
    expect(meta.getByText("Activo")).toBeTruthy();
    expect(meta.getByText("Próxima edición")).toBeTruthy();
    expect(meta.getByText("Octubre 2030")).toBeTruthy();
    expect(meta.getByText(formatDate(START))).toBeTruthy();
    const stat = (label) => meta.getByText(label).nextElementSibling.textContent;
    expect(stat("Ediciones")).toBe("3");
    expect(stat("Veces dictado")).toBe("2");
    expect(stat("Alumnos pagos")).toBe("14");
    expect(stat("Clases por edición")).toBe("4");
    expect(meta.getByText(/4,56 \(9 reseñas\)/)).toBeTruthy();
    expect(meta.getByRole("link", { name: "Ver curso Meta Ads desde cero" }).getAttribute("href")).toBe(
      "/dashboard/courses/c-meta",
    );
    expect(meta.getByRole("button", { name: "Nueva edición de Meta Ads desde cero" })).toBeTruthy();

    const archived = within(cardOf("Email marketing"));
    expect(archived.getByText("Archivado")).toBeTruthy();
    expect(archived.getByText("Sin edición en curso ni próxima")).toBeTruthy();
    expect(archived.getByText("Última: Marzo 2025")).toBeTruthy();
    expect(archived.getByText(/5,0 \(1 reseña\)/)).toBeTruthy();

    expect(within(cardOf("Analítica de campañas")).getByText("Sin reseñas")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("filters the cards by title and description, accent-insensitive", async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminCoursesView courses={COURSES} />);
    const search = screen.getByRole("searchbox", { name: "Buscar cursos" });

    await user.type(search, "analitica");
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-labelledby"))).toEqual([
      "admin-course-c-new",
    ]);
    expect(screen.getByText("1 de 3")).toBeTruthy();

    await user.clear(search);
    await user.type(search, "newsletters");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(cardOf("Email marketing")).toBeTruthy();

    await user.clear(search);
    await user.type(search, "no existe");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByText("Ningún curso coincide con la búsqueda")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("'Nueva edición' creates a new edition and opens its detail page by id", async () => {
    const user = userEvent.setup();
    render(<AdminCoursesView courses={COURSES} />);
    await user.click(screen.getByRole("button", { name: "Nueva edición de Meta Ads desde cero" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(createEditionAction).toHaveBeenCalledWith("c-meta");
    expect(router.push).toHaveBeenCalledWith("/dashboard/courses/c-meta/editions/new-edition");
  });

  it("'Nueva edición' shows the server message and stays on the page when it fails", async () => {
    createEditionAction.mockResolvedValueOnce({
      ok: false,
      status: 400,
      message: "El curso no tiene ediciones para copiar",
    });
    const user = userEvent.setup();
    render(<AdminCoursesView courses={COURSES} />);
    await user.click(screen.getByRole("button", { name: "Nueva edición de Analítica de campañas" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(3000, "Ha habido un error", "El curso no tiene ediciones para copiar"),
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows an empty state without courses", () => {
    render(<AdminCoursesView courses={[]} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByText(/Todavía no hay cursos/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Crear curso" })).toBeTruthy();
  });

  it("'Crear curso' asks for content, price and capacity and posts the course with its Edition 1", async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminCoursesView courses={COURSES} />);
    await user.click(screen.getByRole("button", { name: "Crear curso" }));

    const form = within(screen.getByRole("region", { name: "Crear curso" }));
    await user.type(form.getByLabelText("Título"), "Reels que venden");
    await user.type(form.getByLabelText("Descripción breve"), "Guiones y edición para Reels");
    await user.type(form.getByLabelText("Descripción extendida"), "Un recorrido completo por el formato");
    await user.clear(form.getByLabelText("Precio de la Edición 1"));
    await user.type(form.getByLabelText("Precio de la Edición 1"), "15000");
    await user.clear(form.getByLabelText("Cupo (0 = sin límite)"));
    await user.type(form.getByLabelText("Cupo (0 = sin límite)"), "12");
    await expectNoA11yViolations(container);
    await user.click(form.getByRole("button", { name: "Crear curso" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/courses/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      title: "Reels que venden",
      short_description: "Guiones y edición para Reels",
      full_description: "Un recorrido completo por el formato",
      price: 15000,
      max_participants: 12,
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("region", { name: "Crear curso" })).toBeNull();
  });

  it("'Crear curso' validates before posting", async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminCoursesView courses={COURSES} />);
    await user.click(screen.getByRole("button", { name: "Crear curso" }));
    const form = within(screen.getByRole("region", { name: "Crear curso" }));
    await user.clear(form.getByLabelText("Precio de la Edición 1"));
    await user.type(form.getByLabelText("Precio de la Edición 1"), "-5");
    await user.click(form.getByRole("button", { name: "Crear curso" }));

    await waitFor(() => expect(form.getByLabelText("Título").getAttribute("aria-invalid")).toBe("true"));
    expect(form.getByText("Debe contener al menos 3 caracteres")).toBeTruthy();
    expect(form.getByText("Debe ingresar 0 o mayor")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });
});

describe("CourseForm (edit mode)", () => {
  it("only edits the course content and sends a PATCH", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(
      <CourseForm
        courseData={{
          _id: "c-meta",
          title: "Meta Ads desde cero",
          short_description: "Aprendé a crear campañas rentables",
          full_description: "Todo el recorrido de Meta Ads",
        }}
        onCancel={() => {}}
        onSuccess={onSuccess}
      />,
    );
    expect(screen.queryByLabelText("Precio de la Edición 1")).toBeNull();
    expect(screen.queryByLabelText("Cupo (0 = sin límite)")).toBeNull();
    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Meta Ads avanzado");
    await user.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/courses/c-meta");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      title: "Meta Ads avanzado",
      short_description: "Aprendé a crear campañas rentables",
      full_description: "Todo el recorrido de Meta Ads",
    });
  });
});

// ---------- Student ----------

const myEdition = (overrides) => ({
  courseId: "c-meta",
  courseTitle: "Meta Ads desde cero",
  short_description: "Aprendé a crear campañas rentables",
  status: "published",
  start_date: "2025-03-10T22:00:00.000Z",
  end_date: "2025-04-10T23:00:00.000Z",
  amount_of_classes: 4,
  price: 30000,
  ...overrides,
});
const EDITIONS = [
  myEdition({ _id: "e3", label: "Octubre 2030", title: "Meta Ads desde cero · Octubre 2030", timeStatus: "upcoming", price: 35000, start_date: START, end_date: START, paymentStatus: "pending" }),
  myEdition({ _id: "e2", label: "Marzo 2025", title: "Meta Ads desde cero · Marzo 2025", timeStatus: "completed", paymentStatus: "paid" }),
  myEdition({
    _id: "b2",
    courseId: "c-ig",
    courseTitle: "Contenido para Instagram",
    label: "Marzo 2025",
    title: "Contenido para Instagram · Marzo 2025",
    timeStatus: "in-progress",
    paymentStatus: "paid",
  }),
];

const rowOf = (title) => screen.getByRole("cell", { name: title }).closest("tr");

describe("StudentCoursesView (editions of the student)", () => {
  it("lists each edition as 'Curso · <Mes Año>' with its payment status, never its number", async () => {
    const { container } = render(<StudentCoursesView editions={EDITIONS} reviews={{}} />);
    expect(screen.getByRole("columnheader", { name: "Curso" })).toBeTruthy();

    const pending = within(rowOf("Meta Ads desde cero · Octubre 2030"));
    expect(pending.getByText("Pendiente")).toBeTruthy();
    expect(pending.getByText("$35000")).toBeTruthy();
    expect(pending.getByRole("button", { name: "Cancelar inscripción" })).toBeTruthy();

    const paid = within(rowOf("Meta Ads desde cero · Marzo 2025"));
    expect(paid.getByText("Pagado")).toBeTruthy();
    expect(paid.getByText("Finalizada")).toBeTruthy();
    expect(paid.getByRole("button", { name: "Dejar una reseña" }).disabled).toBe(false);

    const ongoing = within(rowOf("Contenido para Instagram · Marzo 2025"));
    expect(ongoing.getByRole("button", { name: "Disponible al finalizar la edición" }).disabled).toBe(true);

    // Payment instructions only for the pending edition
    const instructions = within(screen.getByRole("region", { name: "Pago pendiente" }));
    expect(instructions.getByText("Meta Ads desde cero · Octubre 2030")).toBeTruthy();
    expect(instructions.queryByText("Meta Ads desde cero · Marzo 2025")).toBeNull();
    expect(container.textContent).not.toMatch(/Edición \d/);
    await expectNoA11yViolations(container);
  });

  it("cancels a pending enrollment by edition", async () => {
    const user = userEvent.setup();
    render(<StudentCoursesView editions={EDITIONS} reviews={{}} />);
    await user.click(within(rowOf("Meta Ads desde cero · Octubre 2030")).getByRole("button", { name: "Cancelar inscripción" }));
    await waitFor(() => expect(cancelEditionEnrollmentAction).toHaveBeenCalledWith("e3"));
  });

  it("reviews each edition through /api/editions/[id]/reviews", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <StudentCoursesView editions={EDITIONS} reviews={{ e2: { rating: 4, comment: "Muy bueno" } }} />,
    );
    await user.click(within(rowOf("Meta Ads desde cero · Marzo 2025")).getByRole("button", { name: "Editar tu reseña" }));

    const dialog = within(screen.getByRole("dialog", { name: "Editar reseña" }));
    expect(dialog.getByText("Meta Ads desde cero · Marzo 2025")).toBeTruthy();
    expect(dialog.getByLabelText("Comentario (opcional)").value).toBe("Muy bueno");
    await expectNoA11yViolations(container);
    await user.click(dialog.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/editions/e2/reviews");
    expect(JSON.parse(init.body)).toEqual({ rating: 4, comment: "Muy bueno" });
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("shows an empty state without enrollments", async () => {
    const { container } = render(<StudentCoursesView editions={[]} reviews={{}} />);
    expect(screen.getByText("No estás inscrito en ningún curso")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Pago pendiente" })).toBeNull();
    await expectNoA11yViolations(container);
  });
});
