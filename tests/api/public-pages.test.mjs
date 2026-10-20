// Server side of the public and student pages of the editions model: /content (courses
// with an open edition), /content/courses/[courseId] (course + open edition + paginated
// reviews, 404 rules) and the dashboard home (counts per role and the next edition).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ObjectId,
  createAdmin,
  createClass,
  createCourseDoc,
  createEdition,
  createUser,
  daysFromNow,
  enrollInEditionDoc,
  resetDb,
  setSession,
} from "../helpers.mjs";

const { notFound, redirect } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((to) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ notFound, redirect }));
// The views are not rendered here: the tests inspect the props the pages pass them
vi.mock("@/app/content/_components/ContentView", () => ({ default: () => null }));
vi.mock("@/app/content/courses/[courseId]/_components/PublicCourseView", () => ({ default: () => null }));

const { default: ContentPage } = await import("@/app/content/page.jsx");
const { formatMonthYearLong } = await import("@/utils/dates");
const coursePage = await import("@/app/content/courses/[courseId]/page.jsx");
const { default: DashboardPage } = await import("@/app/dashboard/page.jsx");

let db, admin, ana, beto;

/** Edition of `course` with one class per entry of `starts` (days from now). */
async function editionWithClasses(course, starts, overrides = {}) {
  const edition = await createEdition(db, course, overrides);
  for (const days of starts) {
    await createClass(db, { editionId: edition._id, status: "enrolled", start_date: daysFromNow(days), duration: 90 });
  }
  return edition;
}

beforeEach(async () => {
  db = await resetDb();
  vi.clearAllMocks();
  admin = await createAdmin(db);
  ana = await createUser(db, { first_name: "Ana" });
  beto = await createUser(db, { first_name: "Beto" });
  setSession(null);
});

describe("/content", () => {
  it("lists active courses with an open edition, by the start of that edition", async () => {
    const later = await createCourseDoc(db, { title: "Más tarde" });
    await editionWithClasses(later, [-60], {}); // finished edition: not open
    const laterOpen = await editionWithClasses(later, [30, 37], { price: 30000, max_participants: 10 });
    const ongoing = await createCourseDoc(db, { title: "En curso" });
    await editionWithClasses(ongoing, [-3, 4]);
    const soon = await createCourseDoc(db, { title: "Pronto" });
    await editionWithClasses(soon, [5]);
    // Not listed: archived course, course with only a draft, course with only finished editions
    await editionWithClasses(await createCourseDoc(db, { title: "Archivado", status: "archived" }), [10]);
    await editionWithClasses(await createCourseDoc(db, { title: "Borrador" }), [10], { status: "draft" });
    await editionWithClasses(await createCourseDoc(db, { title: "Terminado" }), [-20]);
    await enrollInEditionDoc(db, beto, laterOpen, "paid");

    setSession(ana);
    const { props } = await ContentPage();
    expect(props.courses.map((c) => c.title)).toEqual(["En curso", "Pronto", "Más tarde"]);
    const card = props.courses[2];
    expect(card.openEdition).toMatchObject({
      _id: laterOpen._id.toString(),
      label: formatMonthYearLong(daysFromNow(30)),
      price: 30000,
      max_participants: 10,
      amount_of_classes: 2,
      total_duration: 180,
      enrollmentCount: 1,
      timeStatus: "upcoming",
      userPaymentStatus: null,
    });
    expect(typeof card.openEdition.start_date).toBe("string");
    // Public: the date label only, never the edition number
    expect(JSON.stringify(props.courses)).not.toMatch(/"(number|adminNumber|editionCount)":|Edición \d/);
    expect(props.courses[0].openEdition.timeStatus).toBe("in-progress");
    expect(props.viewerRole).toBe("user");
  });
});

describe("/content/courses/[courseId]", () => {
  let course, open;

  const render = async (courseId, query = {}) => {
    const page = await coursePage.default({
      params: Promise.resolve({ courseId }),
      searchParams: Promise.resolve(query),
    });
    // <PageWrapper><PublicCourseView /></PageWrapper>
    return page.props.children.props;
  };

  beforeEach(async () => {
    course = await createCourseDoc(db, { title: "Meta Ads", full_description: "Todo sobre Meta Ads" });
    const first = await editionWithClasses(course, [-90, -83]);
    open = await editionWithClasses(course, [14, 21], { price: 40000, max_participants: 2 });
    // 12 reviews of the first edition, one minute apart
    const reviews = [];
    for (let i = 0; i < 12; i += 1) {
      const student = await createUser(db, { email: `student-${i}@example.com` });
      reviews.push({
        userId: student._id,
        courseId: course._id,
        editionId: first._id,
        rating: i % 2 ? 4 : 5,
        comment: `Reseña ${i}`,
        firstName: `Alumno ${i}`,
        createdAt: new Date(Date.UTC(2030, 0, 1, 0, i)),
        updatedAt: new Date(Date.UTC(2030, 0, 1, 0, i)),
      });
    }
    await db.collection("reviews").insertMany(reviews);
  });

  it("passes the course, its open edition and the first page of every review", async () => {
    const props = await render(course._id.toString());
    expect(props.course).toMatchObject({
      title: "Meta Ads",
      full_description: "Todo sobre Meta Ads",
      avgRating: 4.5,
      reviewCount: 12,
    });
    expect(props.course).not.toHaveProperty("createdBy");
    expect(props.course.openEdition).toMatchObject({
      _id: open._id.toString(),
      label: formatMonthYearLong(daysFromNow(14)),
      price: 40000,
      max_participants: 2,
      amount_of_classes: 2,
      total_duration: 180,
      enrollmentCount: 0,
      timeStatus: "upcoming",
    });
    // Visitors get no payment status
    expect(props.course.openEdition).not.toHaveProperty("userPaymentStatus");
    expect(props.course.openEdition).not.toHaveProperty("number");
    expect(props.course.openEdition).not.toHaveProperty("adminNumber");
    expect(props.viewerRole).toBeNull();
    expect(props.reviews).toMatchObject({ page: 1, totalPages: 2, total: 12 });
    expect(props.reviews.items[0].comment).toBe("Reseña 11");
    expect(JSON.stringify(props.reviews)).not.toMatch(/userId|@example\.com/);
  });

  it("serves ?page= and clamps garbage", async () => {
    const id = course._id.toString();
    expect((await render(id, { page: "2" })).reviews.items.map((r) => r.comment)).toEqual(["Reseña 1", "Reseña 0"]);
    expect((await render(id, { page: "99" })).reviews.page).toBe(2);
    expect((await render(id, { page: "-1" })).reviews.page).toBe(1);
    expect((await render(id, { page: "abc" })).reviews.page).toBe(1);
  });

  it("gives a student their payment status in the open edition", async () => {
    await enrollInEditionDoc(db, ana, open);
    setSession(ana);
    const props = await render(course._id.toString());
    expect(props.course.openEdition).toMatchObject({ userPaymentStatus: "pending", enrollmentCount: 1 });
    expect(props.viewerRole).toBe("user");
  });

  it.each([
    ["a malformed id", () => "not-an-id"],
    ["a missing course", () => new ObjectId().toString()],
  ])("shows the 404 page for %s", async (_, id) => {
    await expect(render(id())).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("hides archived or unpublished courses except from admins and enrollees", async () => {
    const archived = await createCourseDoc(db, { title: "Archivado", status: "archived" });
    const past = await editionWithClasses(archived, [-40]);
    const drafts = await createCourseDoc(db, { title: "Solo borradores" });
    await editionWithClasses(drafts, [10], { status: "draft" });

    for (const hidden of [archived, drafts]) {
      await expect(render(hidden._id.toString())).rejects.toThrow("NOT_FOUND");
    }
    setSession(ana);
    await expect(render(archived._id.toString())).rejects.toThrow("NOT_FOUND");

    // A student of a past edition still sees the course, without an open edition
    await enrollInEditionDoc(db, ana, past, "paid");
    expect((await render(archived._id.toString())).course).toMatchObject({ status: "archived", openEdition: null });

    setSession(admin);
    const forAdmin = await render(drafts._id.toString());
    expect(forAdmin.course.openEdition).toBeNull();
    expect(forAdmin.viewerRole).toBe("admin");
  });

  it("titles the page with the course, or as not found", async () => {
    const meta = await coursePage.generateMetadata({ params: Promise.resolve({ courseId: course._id.toString() }) });
    expect(meta.title).toBe("Meta Ads | MS Academy");
    const missing = await coursePage.generateMetadata({ params: Promise.resolve({ courseId: "nope" }) });
    expect(missing.title).toBe("Curso no encontrado | MS Academy");
  });
});

describe("dashboard home", () => {
  let course, next;

  beforeEach(async () => {
    course = await createCourseDoc(db, { title: "Meta Ads", short_description: "Anuncios" });
    await editionWithClasses(course, [-40]);
    next = await editionWithClasses(course, [6, 13], { price: 25000 });
    await createEdition(db, course, { status: "draft" });
    await createCourseDoc(db, { title: "Viejo", status: "archived" });
  });

  const html = async () => renderToStaticMarkup(await DashboardPage());

  it("admin: courses active/archived, editions draft/published and the next edition", async () => {
    setSession(admin);
    const markup = await html();
    const stat = (title, label) =>
      new RegExp(`<h3>${title}</h3><div[^>]*>(\\d+)</div><div[^>]*>${label}</div>`).exec(markup)?.[1];
    expect(stat("Activos", "Se pueden dictar")).toBe("1");
    expect(stat("Archivados", "Fuera del catálogo")).toBe("1");
    expect(markup).toMatch(/Ediciones<\/span><div[^>]*><div[^>]*><h3>En borrador<\/h3><div[^>]*>1<\/div>/);
    expect(markup).toMatch(/<h3>Publicadas<\/h3><div[^>]*>2<\/div><div[^>]*>Visibles en el sitio/);
    expect(markup).toContain(`<h3>Meta Ads · ${formatMonthYearLong(daysFromNow(6))}</h3>`);
  });

  it("student: pending and paid editions, and their next class and edition", async () => {
    const other = await createCourseDoc(db, { title: "Google Ads" });
    const paidEdition = await editionWithClasses(other, [20]);
    await enrollInEditionDoc(db, ana, next);
    await enrollInEditionDoc(db, ana, paidEdition, "paid");
    setSession(ana);
    const markup = await html();
    expect(markup).toMatch(/<h3>Pre-inscripciones<\/h3><div[^>]*>1<\/div>/);
    expect(markup).toMatch(/<h3>Mis Cursos<\/h3><div[^>]*>1<\/div>/);
    const label = formatMonthYearLong(daysFromNow(6));
    expect(markup).toContain(`<h3>Meta Ads · ${label}</h3>`);
    // The next class belongs to that edition
    expect(markup).toContain(`Meta Ads · ${label}</span>`);
    expect(markup).not.toMatch(/Edición \d/);
  });

  it("sends visitors to the login", async () => {
    await expect(DashboardPage()).rejects.toThrow("REDIRECT /login");
  });
});
