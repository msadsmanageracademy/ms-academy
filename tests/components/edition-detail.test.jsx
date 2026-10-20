// @vitest-environment jsdom
// Admin edition detail /dashboard/courses/[courseId]/editions/[editionId] (breadcrumb, price and
// capacity form with ?edit=1, lifecycle actions, classes, enrollees, reviews) and
// "Vincular clase" in /dashboard/classes (course first, then edition).
import { expectNoA11yViolations, router } from "./setup.jsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminClassesView from "@/app/dashboard/classes/_components/AdminClassesView";
import ClassInfoSection from "@/app/dashboard/classes/[id]/_components/ClassInfoSection";
import EditionDetailView from "@/app/dashboard/courses/[courseId]/editions/[editionId]/_components/EditionDetailView";
import LinkEditionModal, { groupEditionsByCourse } from "@/app/dashboard/classes/_components/LinkEditionModal";
import { confirmDeleteEdition, confirmEditionStatus, confirmPayment, confirmUnlink } from "@/utils/alerts";

const courseActions = vi.hoisted(() => ({
  createEditionAction: vi.fn(async () => ({ ok: true, data: { _id: "e5" } })),
  deleteEditionAction: vi.fn(async () => ({ ok: true })),
  setEditionStatusAction: vi.fn(async () => ({ ok: true })),
  confirmEditionPaymentAction: vi.fn(async () => ({ ok: true })),
  removeEditionEnrollmentAction: vi.fn(async () => ({ ok: true })),
}));
const classActions = vi.hoisted(() => ({
  createClassCalendarEventAction: vi.fn(async () => ({ ok: true, data: {} })),
  deleteClassAction: vi.fn(async () => ({ ok: true })),
  linkClassToEditionAction: vi.fn(async () => ({ ok: true })),
  setClassStatusAction: vi.fn(async () => ({ ok: true })),
  unlinkClassFromEditionAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/server/actions/courses", () => courseActions);
vi.mock("@/server/actions/classes", () => classActions);
vi.mock("@/providers/NotificationProvider", () => ({ useNotifications: () => ({ incrementCount: vi.fn() }) }));
vi.mock("@/hooks/useCalendarConnection", () => ({
  useCalendarConnection: () => ({ hasCalendarAccess: true, connect: vi.fn(), handleReauth: vi.fn() }),
}));
vi.mock("@/utils/alerts", () => ({
  confirmAddToCalendar: vi.fn(async () => ({ isConfirmed: true })),
  confirmDeleteEdition: vi.fn(async () => ({ isConfirmed: true })),
  confirmDeleteItem: vi.fn(async () => ({ isConfirmed: true })),
  confirmEditionStatus: vi.fn(async () => ({ isConfirmed: true })),
  confirmPayment: vi.fn(async () => ({ isConfirmed: true })),
  confirmToggleStatus: vi.fn(async () => ({ isConfirmed: true })),
  confirmUnenroll: vi.fn(async () => ({ isConfirmed: true })),
  confirmUnlink: vi.fn(async () => ({ isConfirmed: true })),
  toastLoading: vi.fn(),
  closeLoading: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const PATH = "/dashboard/courses/c1/editions/e3";
const DAY = 86_400_000;
const future = (days) => new Date(Date.now() + days * DAY).toISOString();
const past = (days) => new Date(Date.now() - days * DAY).toISOString();

const draft = (overrides) => ({
  _id: "e3",
  courseId: "c1",
  label: "Sin fecha",
  adminNumber: 3,
  editionCount: 3,
  status: "draft",
  timeStatus: null,
  price: 30000,
  max_participants: 20,
  start_date: null,
  end_date: null,
  amount_of_classes: 2,
  enrollmentCount: 2,
  paidCount: 1,
  avgRating: null,
  reviewCount: 0,
  course: { _id: "c1", title: "Meta Ads desde cero", status: "active" },
  ...overrides,
});

const completed = (overrides) =>
  draft({
    label: "Marzo 2026",
    adminNumber: 1,
    status: "published",
    timeStatus: "completed",
    start_date: past(60),
    end_date: past(30),
    avgRating: 4.5,
    reviewCount: 12,
    ...overrides,
  });

const CLASSES = [
  { _id: "k1", title: "Clase 1: campañas", start_date: future(10), duration: 90, status: "enrolled" },
  { _id: "k2", title: "Clase 2: métricas", start_date: future(17), duration: 90, status: "enrolled" },
];
const ENROLLMENTS = [
  { _id: "u1", first_name: "Ana", last_name: "Pérez", email: "ana@example.com", paymentStatus: "paid" },
  { _id: "u2", first_name: "Beto", last_name: "", email: "beto@example.com", paymentStatus: "pending" },
];
const NO_REVIEWS = { items: [], page: 1, totalPages: 1, total: 0 };

const renderDetail = (props = {}) =>
  render(
    <EditionDetailView
      classes={CLASSES}
      edition={draft()}
      enrollments={ENROLLMENTS}
      reviews={NO_REVIEWS}
      {...props}
    />,
  );

const section = (name) => within(screen.getByRole("region", { name }));
const info = () => section(/^(Información de la edición|Editar precio y cupo)$/);
const infoValue = (label) => info().getByText(label).nextElementSibling.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__testPathname = PATH;
  window.history.replaceState({}, "", PATH);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ message: "Edición actualizada con éxito", data: {} }) })),
  );
});

afterEach(() => {
  delete globalThis.__testPathname;
  vi.unstubAllGlobals();
});

describe("EditionDetailView: header and data", () => {
  it("shows the breadcrumb 'Curso › <fecha> · Edición N de M' and the edition data", async () => {
    const { container } = renderDetail();
    expect(screen.getByRole("heading", { level: 1, name: "Meta Ads desde cero · Sin fecha" })).toBeTruthy();
    const crumbs = within(screen.getByRole("navigation", { name: "Ubicación" }));
    expect(crumbs.getByRole("link", { name: "Cursos" }).getAttribute("href")).toBe("/dashboard/courses");
    expect(crumbs.getByRole("link", { name: "Meta Ads desde cero" }).getAttribute("href")).toBe("/dashboard/courses/c1");
    const current = crumbs.getByText("Sin fecha · Edición 3 de 3");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Volver al curso" }).getAttribute("href")).toBe("/dashboard/courses/c1");

    expect(infoValue("Edición")).toBe("Sin fecha");
    expect(infoValue("Número")).toBe("Edición 3 de 3");
    expect(infoValue("Estado")).toBe("Borrador");
    expect(infoValue("Fechas")).toBe("Sin fechas (se definen con sus clases)");
    expect(infoValue("Clases")).toBe("2");
    expect(infoValue("Precio")).toBe("ARS 30.000");
    expect(infoValue("Cupo")).toBe("2 / 20");
    expect(infoValue("Alumnos pagos")).toBe("1");
    expect(infoValue("Ingreso estimado")).toBe("ARS 30.000");
    expect(infoValue("Reseñas")).toBe("Sin reseñas");
    await expectNoA11yViolations(container);
  });

  it("names a dated edition by its month, with its admin number", async () => {
    const { container } = renderDetail({ edition: completed({ label: "Septiembre 2026", adminNumber: 2 }) });
    expect(screen.getByRole("heading", { level: 1, name: "Meta Ads desde cero · Septiembre 2026" })).toBeTruthy();
    const crumbs = within(screen.getByRole("navigation", { name: "Ubicación" }));
    expect(crumbs.getByText("Septiembre 2026 · Edición 2 de 3").getAttribute("aria-current")).toBe("page");
    expect(infoValue("Edición")).toBe("Septiembre 2026");
    expect(infoValue("Número")).toBe("Edición 2 de 3");
    await expectNoA11yViolations(container);
  });

  it("lists the classes of the edition, linked to their detail", () => {
    renderDetail();
    const classes = section("Clases de la edición (2)");
    const table = within(classes.getByRole("table", { name: "Clases de la edición" }));
    expect(table.getByText("Clase 1: campañas")).toBeTruthy();
    expect(table.getByRole("link", { name: "Ver clase Clase 2: métricas" }).getAttribute("href")).toBe(
      "/dashboard/classes/k2",
    );
    expect(classes.getByRole("link", { name: "Gestionar clases" }).getAttribute("href")).toBe("/dashboard/classes");
  });

  it("an edition without classes points to Gestión de Clases", () => {
    renderDetail({ classes: [], edition: draft({ amount_of_classes: 0 }) });
    const classes = section("Clases de la edición (0)");
    expect(classes.getByText(/No hay clases asignadas a esta edición/)).toBeTruthy();
    expect(classes.getByRole("link", { name: "Gestión de Clases" }).getAttribute("href")).toBe("/dashboard/classes");
  });

  it("shows a capacity without limit", () => {
    renderDetail({ edition: draft({ max_participants: null, enrollmentCount: 1 }) });
    expect(infoValue("Cupo")).toBe("Sin límite (1 inscripto)");
  });
});

describe("EditionDetailView: participants", () => {
  it("lists enrollees with their payment status and confirms a pending payment", async () => {
    const user = userEvent.setup();
    const { container } = renderDetail();
    const people = section("Participantes (2 / 20)");
    const table = within(people.getByRole("table", { name: "Participantes de la edición" }));
    const ana = within(table.getByText("Ana").closest("tr"));
    const beto = within(table.getByText("Beto").closest("tr"));
    expect(ana.getByText("Pagado")).toBeTruthy();
    expect(beto.getByText("Pendiente")).toBeTruthy();
    expect(ana.getByRole("button", { name: "Pago de Ana Pérez confirmado" }).disabled).toBe(true);
    expect(ana.getByRole("button", { name: "Remover a Ana Pérez" }).disabled).toBe(true);
    await expectNoA11yViolations(container);

    await user.click(beto.getByRole("button", { name: "Confirmar pago de Beto" }));
    await waitFor(() => expect(courseActions.confirmEditionPaymentAction).toHaveBeenCalledWith("e3", "u2"));
    expect(confirmPayment).toHaveBeenCalledWith("Meta Ads desde cero · Sin fecha", "Beto");
  });

  it("removes a pending enrollee", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("button", { name: "Remover a Beto" }));
    await waitFor(() => expect(courseActions.removeEditionEnrollmentAction).toHaveBeenCalledWith("e3", "u2"));
  });

  it("shows an empty state without enrollees", () => {
    renderDetail({ enrollments: [], edition: draft({ enrollmentCount: 0, paidCount: 0 }) });
    expect(section("Participantes (0 / 20)").getByText("No hay participantes inscriptos")).toBeTruthy();
  });
});

describe("EditionDetailView: price and capacity form", () => {
  it("?edit=1 opens the form; closing it drops 'edit' from the URL", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", `${PATH}?edit=1`);
    const { container } = renderDetail({ initialEditMode: true });
    const form = section("Editar precio y cupo");
    expect(form.getByLabelText("Precio").value).toBe("30000");
    expect(form.getByLabelText("Cupo (0 = sin límite)").value).toBe("20");
    await expectNoA11yViolations(container);

    await user.click(form.getByRole("button", { name: "Cancelar" }));
    expect(router.replace).toHaveBeenCalledWith(PATH, { scroll: false });
    expect(screen.getByRole("region", { name: "Información de la edición" })).toBeTruthy();
  });

  it("saves price and capacity with PATCH /api/editions/[id], then refreshes", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", `${PATH}?edit=1`);
    renderDetail({ initialEditMode: true });
    const form = section("Editar precio y cupo");
    await user.clear(form.getByLabelText("Precio"));
    await user.type(form.getByLabelText("Precio"), "35000");
    await user.clear(form.getByLabelText("Cupo (0 = sin límite)"));
    await user.type(form.getByLabelText("Cupo (0 = sin límite)"), "0");
    await user.click(form.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/editions/e3");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ price: 35000, max_participants: 0 });
    expect(router.replace).toHaveBeenCalledWith(PATH, { scroll: false });
    expect(screen.queryByRole("region", { name: "Editar precio y cupo" })).toBeNull();
  });

  it("rejects a negative price without calling the API", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("button", { name: "Editar precio y cupo" }));
    const form = section("Editar precio y cupo");
    await user.clear(form.getByLabelText("Precio"));
    await user.type(form.getByLabelText("Precio"), "-5");
    await user.click(form.getByRole("button", { name: "Guardar" }));
    expect(await form.findByText("Debe ingresar 0 o mayor")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opened from the page (no ?edit) closing leaves the URL alone", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("button", { name: "Editar precio y cupo" }));
    await user.click(section("Editar precio y cupo").getByRole("button", { name: "Cancelar" }));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Información de la edición" })).toBeTruthy();
  });
});

describe("EditionDetailView: lifecycle actions", () => {
  it("publishes a draft whose classes are all dated in the future", async () => {
    const user = userEvent.setup();
    renderDetail();
    expect(screen.queryByRole("note")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Publicar edición" }));
    await waitFor(() => expect(courseActions.setEditionStatusAction).toHaveBeenCalledWith("e3", "published"));
    expect(confirmEditionStatus).toHaveBeenCalledWith("published", "Meta Ads desde cero · Sin fecha");
  });

  it.each([
    ["without classes", { classes: [] }, "una edición sin clases asignadas"],
    [
      "with an undated class",
      { classes: [CLASSES[0], { ...CLASSES[1], start_date: null }] },
      "1 clase(s) no tienen fecha asignada",
    ],
    [
      "of an archived course",
      { edition: draft({ course: { _id: "c1", title: "Meta Ads desde cero", status: "archived" } }) },
      "un curso archivado",
    ],
  ])("can't publish a draft %s and says why", (_, props, reason) => {
    renderDetail(props);
    const publish = screen.getByRole("button", { name: "Publicar edición" });
    expect(publish.disabled).toBe(true);
    expect(publish.getAttribute("title")).toContain(reason);
    expect(screen.getByRole("note").textContent).toContain(reason);
  });

  it("a published edition: no price/capacity edit or delete, but it can be unpublished", async () => {
    const user = userEvent.setup();
    const { container } = renderDetail({ edition: completed() });
    const edit = screen.getByRole("button", { name: "Editar precio y cupo" });
    expect(edit.disabled).toBe(true);
    expect(edit.getAttribute("title")).toBe("No se pueden editar el precio ni el cupo de una edición publicada");
    const remove = screen.getByRole("button", { name: "Eliminar edición" });
    expect(remove.disabled).toBe(true);
    expect(remove.getAttribute("title")).toBe("No se puede eliminar una edición publicada. Despublicala primero.");
    expect(infoValue("Estado")).toBe("PublicadaFinalizada");
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole("button", { name: "Despublicar edición" }));
    await waitFor(() => expect(courseActions.setEditionStatusAction).toHaveBeenCalledWith("e3", "draft"));
    expect(confirmEditionStatus).toHaveBeenCalledWith("draft", "Meta Ads desde cero · Marzo 2026");
  });

  it("an edition in progress can't be unpublished", () => {
    renderDetail({ edition: completed({ timeStatus: "in-progress" }) });
    const unpublish = screen.getByRole("button", { name: "Despublicar edición" });
    expect(unpublish.disabled).toBe(true);
    expect(unpublish.getAttribute("title")).toMatch(/en curso/);
  });

  it("deletes a draft (warning about its enrollees) and goes back to the course", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("button", { name: "Eliminar edición" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/courses/c1"));
    expect(confirmDeleteEdition).toHaveBeenCalledWith("Meta Ads desde cero · Sin fecha", 2);
    expect(courseActions.deleteEditionAction).toHaveBeenCalledWith("e3");
  });

  it("does not delete when the server refuses", async () => {
    const user = userEvent.setup();
    courseActions.deleteEditionAction.mockResolvedValueOnce({ ok: false, message: "No" });
    renderDetail();
    await user.click(screen.getByRole("button", { name: "Eliminar edición" }));
    await waitFor(() => expect(courseActions.deleteEditionAction).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
  });

  it("'Nueva edición' creates a new edition of the course and opens it by id", async () => {
    const user = userEvent.setup();
    renderDetail({ edition: completed() });
    await user.click(screen.getByRole("button", { name: "Crear una nueva edición de este curso" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/courses/c1/editions/e5"));
    expect(courseActions.createEditionAction).toHaveBeenCalledWith("c1");
  });
});

describe("EditionDetailView: reviews", () => {
  const review = (i) => ({
    _id: `r${i}`,
    rating: 5,
    comment: `Muy buena ${i}`,
    firstName: `Alumno ${i}`,
    createdAt: "2026-04-20T00:00:00.000Z",
    editionId: "e3",
    editionLabel: "Marzo 2026",
  });

  it("shows this edition's reviews without a filter, paginated through the URL", async () => {
    const user = userEvent.setup();
    const reviews = { items: [review(1), review(2)], page: 1, totalPages: 2, total: 12 };
    const { container } = renderDetail({ edition: completed(), reviews });
    const block = section(/^Reseñas/);
    expect(block.getByRole("heading", { level: 2 }).textContent).toMatch(/4,5 \(12\)/);
    expect(block.queryByLabelText("Edición")).toBeNull();
    expect(block.getByText("Muy buena 1")).toBeTruthy();
    expect(block.queryByText("Marzo 2026")).toBeNull();
    await expectNoA11yViolations(container);

    await user.click(block.getByRole("button", { name: "Página 2" }));
    expect(router.push).toHaveBeenLastCalledWith(`${PATH}?page=2`, { scroll: false });
  });

  it("explains when reviews arrive for an edition that hasn't finished", () => {
    renderDetail();
    expect(
      section(/^Reseñas/).getByText("Los alumnos con pago confirmado van a poder reseñarla cuando finalice."),
    ).toBeTruthy();
  });
});

// ---------- "Vincular clase" ----------

const EDITIONS = [
  { _id: "e1", courseId: "c1", courseTitle: "Meta Ads", adminNumber: 1, label: "Marzo 2026", title: "Meta Ads · Marzo 2026", status: "published" },
  { _id: "e2", courseId: "c1", courseTitle: "Meta Ads", adminNumber: 2, label: "Sin fecha", title: "Meta Ads · Sin fecha", status: "draft" },
  { _id: "e9", courseId: "c2", courseTitle: "Branding", adminNumber: 1, label: "Sin fecha", title: "Branding · Sin fecha", status: "draft" },
];

describe("groupEditionsByCourse", () => {
  it("groups by course (sorted by title) with the chronologically last edition first", () => {
    const courses = groupEditionsByCourse(EDITIONS);
    expect(courses.map((c) => c.title)).toEqual(["Branding", "Meta Ads"]);
    expect(courses[1].editions.map((e) => e.adminNumber)).toEqual([2, 1]);
    expect(groupEditionsByCourse([])).toEqual([]);
  });
});

describe("LinkEditionModal", () => {
  it("asks for the course first and then one of its editions", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { container } = render(
      <LinkEditionModal classTitle="Clase suelta" editions={EDITIONS} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    const dialog = within(screen.getByRole("dialog", { name: "Vincular clase a una edición" }));
    const courseSelect = dialog.getByRole("combobox", { name: "Curso" });
    const editionSelect = dialog.getByRole("combobox", { name: "Edición" });
    expect(editionSelect.disabled).toBe(true);
    expect(dialog.getByRole("button", { name: "Vincular" }).disabled).toBe(true);
    await expectNoA11yViolations(container);

    await user.selectOptions(courseSelect, "c1");
    expect(editionSelect.disabled).toBe(false);
    expect(within(editionSelect).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Seleccionar edición...",
      "Sin fecha (borrador)",
      "Marzo 2026 (publicada)",
    ]);
    await user.selectOptions(editionSelect, "e2");

    // Changing the course clears the chosen edition (also when coming back to the first course)
    await user.selectOptions(courseSelect, "c2");
    expect(editionSelect.value).toBe("");
    expect(dialog.getByRole("button", { name: "Vincular" }).disabled).toBe(true);
    await user.selectOptions(courseSelect, "c1");
    expect(editionSelect.value).toBe("");
    expect(dialog.getByRole("button", { name: "Vincular" }).disabled).toBe(true);
    await user.selectOptions(courseSelect, "c2");

    await user.selectOptions(editionSelect, "e9");
    await user.click(dialog.getByRole("button", { name: "Vincular" }));
    expect(onConfirm).toHaveBeenCalledWith(EDITIONS[2]);
  });

  it("says so when there are no editions to link to", () => {
    render(<LinkEditionModal classTitle="Clase" editions={[]} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/Todavía no hay cursos con ediciones/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vincular" }).disabled).toBe(true);
  });
});

describe("ClassInfoSection: edition of a class", () => {
  const cls = { _id: "k1", title: "Clase 1", duration: 60, price: 0, status: "enrolled", start_date: null };

  it("names and links the edition of an edition class", async () => {
    const edition = { _id: "e2", courseId: "c1", courseTitle: "Meta Ads", label: "Septiembre 2026", status: "draft", timeStatus: null };
    const { container } = render(
      <ClassInfoSection classData={{ ...cls, editionId: "e2" }} edition={edition} onEdit={vi.fn()} />,
    );
    expect(screen.getByText("Meta Ads · Septiembre 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver edición" }).getAttribute("href")).toBe(
      "/dashboard/courses/c1/editions/e2",
    );
    await expectNoA11yViolations(container);
  });

  it("standalone classes say so", () => {
    render(<ClassInfoSection classData={{ ...cls, status: "draft" }} edition={null} onEdit={vi.fn()} />);
    expect(screen.getByText("Clase independiente")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ver edición" })).toBeNull();
  });

  it("an edition class whose edition could not be loaded says so", () => {
    render(<ClassInfoSection classData={{ ...cls, editionId: "e2" }} edition={null} onEdit={vi.fn()} />);
    expect(screen.getByText("Edición no disponible")).toBeTruthy();
    expect(screen.queryByText("Clase independiente")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver edición" })).toBeNull();
  });
});

describe("AdminClassesView: classes and editions", () => {
  const CLASS_LIST = [
    {
      _id: "cl1",
      title: "Clase suelta",
      start_date: future(5),
      duration: 60,
      price: 0,
      status: "draft",
      participantsCount: 0,
      max_participants: null,
    },
    {
      _id: "cl2",
      title: "Clase de Meta Ads",
      start_date: future(9),
      duration: 90,
      price: 0,
      status: "enrolled",
      participantsCount: 3,
      max_participants: null,
      editionId: "e2",
      courseId: "c1",
      courseTitle: "Meta Ads",
      editionLabel: "Septiembre 2026",
    },
  ];

  it("shows the course and edition of each class, linked to the edition page", async () => {
    const { container } = render(<AdminClassesView classes={CLASS_LIST} editions={EDITIONS} />);
    const row = within(screen.getByText("Clase de Meta Ads").closest("tr"));
    expect(row.getByRole("link", { name: "Meta Ads" }).getAttribute("href")).toBe("/dashboard/courses/c1/editions/e2");
    expect(row.getByText("Septiembre 2026")).toBeTruthy();
    expect(within(screen.getByText("Clase suelta").closest("tr")).getByText("—")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("links a standalone class to the chosen edition", async () => {
    const user = userEvent.setup();
    render(<AdminClassesView classes={CLASS_LIST} editions={EDITIONS} />);
    await user.click(screen.getByRole("button", { name: "Vincular a una edición" }));
    const dialog = within(screen.getByRole("dialog", { name: "Vincular clase a una edición" }));
    await user.selectOptions(dialog.getByRole("combobox", { name: "Curso" }), "c1");
    await user.selectOptions(dialog.getByRole("combobox", { name: "Edición" }), "e2");
    await user.click(dialog.getByRole("button", { name: "Vincular" }));
    await waitFor(() => expect(classActions.linkClassToEditionAction).toHaveBeenCalledWith("cl1", "e2"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("unlinks an edition class after confirming with its edition", async () => {
    const user = userEvent.setup();
    render(<AdminClassesView classes={CLASS_LIST} editions={EDITIONS} />);
    await user.click(screen.getByRole("button", { name: 'Desvincular de "Meta Ads · Septiembre 2026"' }));
    await waitFor(() => expect(classActions.unlinkClassFromEditionAction).toHaveBeenCalledWith("cl2"));
    expect(confirmUnlink).toHaveBeenCalledWith("Clase de Meta Ads", "Meta Ads · Septiembre 2026");
  });

  it("filters by the course of each class's edition", async () => {
    const user = userEvent.setup();
    render(<AdminClassesView classes={CLASS_LIST} editions={EDITIONS} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por curso" }), "c1");
    expect(screen.queryByText("Clase suelta")).toBeNull();
    expect(screen.getByText("Clase de Meta Ads")).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por curso" }), "none");
    expect(screen.getByText("Clase suelta")).toBeTruthy();
    expect(screen.queryByText("Clase de Meta Ads")).toBeNull();
  });
});
