// @vitest-environment jsdom
// /content: header, course cards (with their open edition), class agenda CTAs by viewer and
// empty states; /content/courses/[courseId]: open edition, enrollment states and reviews.
import { expectNoA11yViolations, router } from "./setup.jsx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContentView from "@/app/content/_components/ContentView";
import PublicCourseView from "@/app/content/courses/[courseId]/_components/PublicCourseView";
import { confirmSignUp, toastError } from "@/utils/alerts";
import { loginUrl } from "@/utils/redirects";

const { enrollInClassAction, enrollInEditionAction, incrementCount } = vi.hoisted(() => ({
  enrollInClassAction: vi.fn(async () => ({ ok: true, message: "Te inscribiste" })),
  enrollInEditionAction: vi.fn(async () => ({ ok: true, message: "Pre-inscripción realizada" })),
  incrementCount: vi.fn(),
}));

vi.mock("@/server/actions/classes", () => ({ enrollInClassAction }));
vi.mock("@/server/actions/courses", () => ({ enrollInEditionAction }));
vi.mock("@/providers/NotificationProvider", () => ({
  useNotifications: () => ({ unreadCount: 0, incrementCount }),
}));
vi.mock("@/utils/alerts", () => ({
  confirmSignUp: vi.fn(async () => ({ isConfirmed: true })),
  toastLoading: vi.fn(),
  closeLoading: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

// 22:00 UTC = 19:00 in Argentina
const START = "2030-09-17T22:00:00.000Z";

const makeClass = (overrides) => ({
  _id: `class-${overrides.title}`,
  short_description: "Descripción de la clase",
  duration: 60,
  start_date: START,
  status: "published",
  max_participants: null,
  participantsCount: 0,
  isParticipant: false,
  ...overrides,
});

const CLASSES = [
  makeClass({ _id: "c-open", title: "Clase abierta" }),
  makeClass({ _id: "c-low", title: "Clase con cupo", max_participants: 5, participantsCount: 3 }),
  makeClass({ _id: "c-full", title: "Clase llena", max_participants: 2, participantsCount: 2 }),
  makeClass({ _id: "c-mine", title: "Clase mía", max_participants: 10, participantsCount: 1, isParticipant: true }),
];

/** Edition open to enrollment, as listCourses / getCourseDetail return it. */
const makeEdition = (overrides) => ({
  _id: "e1",
  label: "Septiembre 2030",
  price: 0,
  max_participants: null,
  start_date: START,
  end_date: "2030-10-30T22:00:00.000Z",
  amount_of_classes: 4,
  total_duration: 240,
  enrollmentCount: 0,
  timeStatus: "upcoming",
  ...overrides,
});

// Course of the public catalog: price, dates and seats live in its open edition
const makeCourse = ({ edition, ...overrides }) => ({
  short_description: "Descripción del curso",
  avgRating: null,
  reviewCount: 0,
  ...overrides,
  openEdition: makeEdition(edition),
});

const COURSES = [
  makeCourse({
    _id: "k-paid",
    title: "Curso pago",
    avgRating: 4.5,
    reviewCount: 2,
    edition: { _id: "e-paid", label: "Septiembre 2030 (2)", userPaymentStatus: "paid", price: 25000 },
  }),
  makeCourse({ _id: "k-pending", title: "Curso pendiente", edition: { userPaymentStatus: "pending" } }),
  makeCourse({
    _id: "k-ongoing",
    title: "Curso en curso",
    edition: {
      label: "Enero 2020",
      start_date: "2020-01-01T22:00:00.000Z",
      end_date: "2030-12-31T22:00:00.000Z",
      max_participants: 10,
      enrollmentCount: 4,
      timeStatus: "in-progress",
    },
  }),
];

const asVisitor = (items) => items.map((item) => ({ ...item, isParticipant: false }));
const article = (name) => within(screen.getByRole("article", { name }));

beforeEach(() => {
  vi.clearAllMocks();
  router.push.mockReset();
});

describe("ContentView as a visitor", () => {
  it("renders the header, both sections, seats, prices and course details", async () => {
    const { container } = render(
      <ContentView classes={asVisitor(CLASSES)} courses={COURSES} viewerRole={null} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Próximas actividades" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Cursos" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Clases gratuitas" })).toBeTruthy();
    expect(screen.getByText("3 cursos · 4 clases")).toBeTruthy();

    expect(article("Clase abierta").getByText("Cupo ilimitado")).toBeTruthy();
    expect(article("Clase con cupo").getByText("Últimos 2 lugares")).toBeTruthy();
    expect(article("Clase llena").getAllByText("Cupo completo").length).toBeGreaterThan(0);
    expect(article("Curso en curso").getByText("Quedan 6 lugares")).toBeTruthy();
    expect(screen.getAllByText("19:00 · 60 min")).toHaveLength(4);

    expect(article("Curso pago").getByText("ARS 25.000")).toBeTruthy();
    expect(article("Curso pendiente").getByText("Gratis")).toBeTruthy();
    expect(screen.getAllByText("Por comenzar")).toHaveLength(2);
    expect(article("Curso en curso").getByText("En curso")).toBeTruthy();
    expect(article("Curso en curso").getByText(/Comenzó el/)).toBeTruthy();
    // Dates and date label of the open edition (never its number)
    expect(article("Curso pago").getByText("Curso · Septiembre 2030 (2)")).toBeTruthy();
    expect(article("Curso en curso").getByText("Curso · Enero 2020")).toBeTruthy();
    expect(screen.queryByText(/Edición \d/)).toBeNull();
    expect(article("Curso pago").getByText("17/09/2030").getAttribute("datetime")).toBe(START);
    expect(article("Curso pago").getByText("30/10/2030")).toBeTruthy();
    expect(article("Curso pago").getByText("4 clases")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver curso Curso pago" }).getAttribute("href")).toBe(
      "/content/courses/k-paid",
    );
    expect(article("Curso pago").getByRole("img", { name: "4,5 de 5 estrellas" })).toBeTruthy();
    expect(article("Curso pago").getByText(/\(2 reseñas\)/)).toBeTruthy();
    // No rating without reviews
    expect(article("Curso pendiente").queryByRole("img")).toBeNull();

    const full = screen.getByRole("button", { name: "Cupo completo en Clase llena" });
    expect(full.disabled).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("sends the visitor to login and back to /content", async () => {
    const user = userEvent.setup();
    render(<ContentView classes={asVisitor(CLASSES)} courses={COURSES} viewerRole={null} />);
    await user.click(screen.getByRole("button", { name: "Inscribirme a Clase abierta" }));
    expect(router.push).toHaveBeenCalledWith(loginUrl("/content"));
    expect(enrollInClassAction).not.toHaveBeenCalled();
  });
});

describe("ContentView as a student", () => {
  it("shows enrolled states for classes and courses", async () => {
    const { container } = render(<ContentView classes={CLASSES} courses={COURSES} viewerRole="user" />);
    const mine = article("Clase mía");
    expect(mine.getByRole("button", { name: "Ya estás inscripto en Clase mía" }).disabled).toBe(true);
    expect(mine.getByRole("link", { name: "Ver mis clases (Clase mía)" }).getAttribute("href")).toBe("/dashboard/classes");
    expect(mine.queryByRole("button", { name: /^Inscribirme/ })).toBeNull();

    expect(article("Curso pago").getByText("Ya estás inscripto")).toBeTruthy();
    expect(article("Curso pendiente").getByText("Pago pendiente")).toBeTruthy();
    expect(article("Curso en curso").queryByText("Ya estás inscripto")).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("enrolls through the Server Action and goes to the dashboard", async () => {
    const user = userEvent.setup();
    render(<ContentView classes={CLASSES} courses={COURSES} viewerRole="user" />);
    await user.click(screen.getByRole("button", { name: "Inscribirme a Clase abierta" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/classes"));
    expect(confirmSignUp).toHaveBeenCalledTimes(1);
    expect(enrollInClassAction).toHaveBeenCalledWith("c-open");
    expect(incrementCount).toHaveBeenCalledTimes(1);
  });
});

describe("ContentView as an admin", () => {
  it("offers management links instead of sign-up", async () => {
    const { container } = render(<ContentView classes={CLASSES} courses={COURSES} viewerRole="admin" />);
    expect(screen.queryAllByRole("button", { name: /^Inscribirme/ })).toHaveLength(0);
    for (const { title } of CLASSES) {
      expect(screen.getByRole("link", { name: `Gestionar ${title}` }).getAttribute("href")).toBe(
        "/dashboard/classes",
      );
    }
    for (const { _id, title } of COURSES) {
      // The admin page of the course (not of the edition)
      expect(screen.getByRole("link", { name: `Gestionar ${title}` }).getAttribute("href")).toBe(
        `/dashboard/courses/${_id}`,
      );
      expect(screen.getByRole("link", { name: `Ver curso ${title}` })).toBeTruthy();
    }
    await expectNoA11yViolations(container);
  });
});

describe("ContentView empty states", () => {
  it("shows a single block with a contact link when there is nothing scheduled", async () => {
    const { container } = render(<ContentView classes={[]} courses={[]} viewerRole={null} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Por ahora no hay actividades programadas" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Escribime para enterarte de las próximas fechas" }).getAttribute("href"),
    ).toBe("/contact");
    expect(screen.queryByRole("heading", { name: "Cursos" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Clases gratuitas" })).toBeNull();
    // No counters line
    expect(screen.queryByText(/^\d+ (curso|clase)s?/)).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("hides the classes section when there are no classes", () => {
    render(<ContentView classes={[]} courses={COURSES} viewerRole={null} />);
    expect(screen.getByRole("heading", { name: "Cursos" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Clases gratuitas" })).toBeNull();
    expect(screen.getByText("3 cursos")).toBeTruthy();
  });

  it("hides the courses section when there are no courses", () => {
    render(<ContentView classes={asVisitor(CLASSES)} courses={[]} viewerRole={null} />);
    expect(screen.getByRole("heading", { name: "Clases gratuitas" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Cursos" })).toBeNull();
    expect(screen.getByText("4 clases")).toBeTruthy();
  });
});

// ---------- /content/courses/[courseId] ----------

const reviewItems = (count, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({
    _id: `r${offset + i}`,
    rating: 5,
    comment: `Reseña ${offset + i}`,
    firstName: `Alumno ${offset + i}`,
    createdAt: "2030-01-01T00:00:00.000Z",
    editionLabel: "Enero 2030",
  }));

const REVIEWS = { items: reviewItems(10), page: 1, totalPages: 2, total: 12 };

const makeCoursePage = ({ edition = {}, ...overrides } = {}) => ({
  _id: "k1",
  title: "Meta Ads",
  short_description: "Anuncios que venden",
  full_description: "Todo sobre Meta Ads",
  status: "active",
  avgRating: 4.5,
  reviewCount: 12,
  ...overrides,
  openEdition: edition === null ? null : makeEdition({ _id: "e2", label: "Septiembre 2030", price: 40000, max_participants: 10, enrollmentCount: 3, ...edition }),
});

const renderCourse = ({ course = makeCoursePage(), reviews = REVIEWS, viewerRole = null } = {}) =>
  render(<PublicCourseView course={course} reviews={reviews} viewerRole={viewerRole} />);

// Disabled PrimaryLink (no href): its aria-disabled
const disabledAction = (text) => screen.getByText(text).closest("a").getAttribute("aria-disabled");

const info = (label) => screen.getByText(label, { selector: "dt" }).nextElementSibling.textContent;

describe("PublicCourseView", () => {
  beforeEach(() => {
    globalThis.__testPathname = "/content/courses/k1";
  });

  it("shows the course, its open edition and the first page of reviews", async () => {
    const { container } = renderCourse();
    expect(screen.getByRole("heading", { level: 1, name: "Meta Ads" })).toBeTruthy();
    expect(screen.getByText("Todo sobre Meta Ads")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Próxima edición: Septiembre 2030" })).toBeTruthy();
    expect(screen.queryByText(/Edición \d/)).toBeNull();
    expect(info("Fecha de inicio")).toBe("17/09/2030, 19:00");
    expect(info("Cantidad de clases")).toBe("4");
    expect(info("Duración total")).toBe("4 horas");
    expect(info("Cupo")).toBe("3 / 10 inscriptos");
    expect(info("Estado")).toBe("Por comenzar");
    expect(info("Precio")).toBe("ARS 40.000");
    // Rating of the whole course next to the heading
    expect(screen.getByRole("heading", { level: 2, name: /^Reseñas/ }).textContent).toContain("(12)");
    expect(screen.getAllByRole("listitem").filter((li) => li.textContent.includes("Reseña"))).toHaveLength(10);
    expect(screen.getByRole("navigation", { name: "Paginación de reseñas" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Pago pendiente" })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("moves through the reviews with ?page= (page 1 without it)", async () => {
    const user = userEvent.setup();
    renderCourse();
    await user.click(screen.getByRole("button", { name: "Página 2" }));
    expect(router.push).toHaveBeenCalledWith("/content/courses/k1?page=2", { scroll: false });

    router.push.mockReset();
    renderCourse({ reviews: { items: reviewItems(2, 10), page: 2, totalPages: 2, total: 12 } });
    const [, second] = screen.getAllByRole("navigation", { name: "Paginación de reseñas" });
    await user.click(within(second).getByRole("button", { name: "Página 1" }));
    expect(router.push).toHaveBeenCalledWith("/content/courses/k1", { scroll: false });
  });

  it("without reviews shows the empty text and no pagination", () => {
    renderCourse({ course: makeCoursePage({ avgRating: null, reviewCount: 0 }), reviews: { items: [], page: 1, totalPages: 1, total: 0 } });
    expect(screen.getByText("Todavía no hay reseñas para este curso.")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("a visitor goes to the login and back to the course", async () => {
    const user = userEvent.setup();
    renderCourse();
    await user.click(screen.getByRole("button", { name: "Inscribirse" }));
    expect(router.push).toHaveBeenCalledWith(loginUrl("/content/courses/k1"));
    expect(enrollInEditionAction).not.toHaveBeenCalled();
  });

  it("a student enrolls in the open edition and goes to Mis cursos", async () => {
    const user = userEvent.setup();
    renderCourse({ course: makeCoursePage({ edition: { userPaymentStatus: null } }), viewerRole: "user" });
    await user.click(screen.getByRole("button", { name: "Inscribirse" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/courses"));
    expect(confirmSignUp).toHaveBeenCalledWith(
      "¿Querés inscribirte a este curso?",
      'Confirmá que querés inscribirte a "Meta Ads · Septiembre 2030"',
    );
    expect(enrollInEditionAction).toHaveBeenCalledWith("e2");
  });

  it("a pending enrollment shows the payment instructions of the edition", async () => {
    const { container } = renderCourse({
      course: makeCoursePage({ edition: { userPaymentStatus: "pending" } }),
      viewerRole: "user",
    });
    expect(disabledAction("Inscripción pendiente de pago")).toBe("true");
    const payment = within(screen.getByRole("region", { name: "Pago pendiente" }));
    expect(payment.getByText("Meta Ads · Septiembre 2030")).toBeTruthy();
    expect(payment.getByText(/ARS 40\.000/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Inscribirse" })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it.each([
    ["paid", { userPaymentStatus: "paid" }, "Ya estás inscripto"],
    ["in progress", { userPaymentStatus: null, timeStatus: "in-progress" }, "En curso: inscripción cerrada"],
    ["full", { userPaymentStatus: null, enrollmentCount: 10 }, "Cupo completo"],
  ])("a student can't enroll when the edition is %s", (_, edition, text) => {
    renderCourse({ course: makeCoursePage({ edition }), viewerRole: "user" });
    expect(disabledAction(text)).toBe("true");
    expect(screen.queryByRole("button", { name: "Inscribirse" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Pago pendiente" })).toBeNull();
  });

  it("shows a full edition and an unlimited one", () => {
    renderCourse({ course: makeCoursePage({ edition: { enrollmentCount: 10 } }) });
    expect(info("Cupo")).toBe("10 / 10 inscriptos (completo)");
    renderCourse({ course: makeCoursePage({ _id: "k2", edition: { max_participants: null, price: 0 } }) });
    expect(screen.getAllByText("Sin límite")).toHaveLength(1);
    expect(screen.getAllByText("Gratis")).toHaveLength(1);
  });

  it("an admin manages the course instead of enrolling", () => {
    renderCourse({ viewerRole: "admin" });
    expect(screen.getByRole("link", { name: "Gestionar curso" }).getAttribute("href")).toBe("/dashboard/courses/k1");
    expect(screen.queryByRole("button", { name: "Inscribirse" })).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("without an open edition says so (enrollees of past editions and admins still see it)", async () => {
    const { container, unmount } = renderCourse({
      course: makeCoursePage({ status: "archived", edition: null }),
      viewerRole: "user",
    });
    expect(screen.getByRole("heading", { level: 2, name: "Próxima edición" })).toBeTruthy();
    expect(screen.getByText(/no hay una edición abierta a inscripción/)).toBeTruthy();
    expect(screen.queryByText("Fecha de inicio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Inscribirse" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ir a Contacto" }).getAttribute("href")).toBe("/contact");
    await expectNoA11yViolations(container);
    unmount();

    renderCourse({ course: makeCoursePage({ edition: null }), viewerRole: "admin" });
    expect(screen.getByRole("link", { name: "Gestionar curso" }).getAttribute("href")).toBe("/dashboard/courses/k1");
  });
});
