// Demo data for `npm run db:seed` (scripts/db-seed.mjs). Pure: no database access and
// no "@/" imports, so plain Node scripts and the tests can load it.
// Every date is relative to `now`, so the scenario keeps its time statuses whenever it runs:
//   Course A: editions 1 and 2 completed (paid students, reviews), edition 3 published and upcoming
//   Course B: edition 1 completed (reviews), edition 2 in progress
//   Course C: edition 1 draft, classes without dates
//   Standalone free classes: 2 upcoming and 1 past
import { ObjectId } from "mongodb";

const HOUR = 3600000;
const DAY = 24 * HOUR;

/** The student account that gets some demo enrollments when it exists. */
export const OWN_USER_EMAIL = "user@user.com";

/** Demo students (`demo-*` emails: the seed deletes and recreates them on every run). */
export const DEMO_USERS = [
  { first_name: "Ana", last_name: "García", email: "demo-ana.garcia@example.com" },
  { first_name: "Bruno", last_name: "Pereyra", email: "demo-bruno.pereyra@example.com" },
  { first_name: "Carla", last_name: "Méndez", email: "demo-carla.mendez@example.com" },
  { first_name: "Diego", last_name: "Sosa", email: "demo-diego.sosa@example.com" },
  { first_name: "Elena", last_name: "Ruiz", email: "demo-elena.ruiz@example.com" },
  { first_name: "Federico", last_name: "Luna", email: "demo-federico.luna@example.com" },
  { first_name: "Gabriela", last_name: "Torres", email: "demo-gabriela.torres@example.com" },
  { first_name: "Hernán", last_name: "Acosta", email: "demo-hernan.acosta@example.com" },
];

/** Matches the demo users' emails (deletion filter). */
export const DEMO_EMAIL_PATTERN = /^demo-/;

export const SEED_USAGE = [
  "Usage: npm run db:seed -- --yes",
  "Deletes courses, courseEditions, classes, courseEnrollments, reviews, notifications and the",
  "demo-* users of the MONGODB_DB_NAME database (other users are kept) and recreates the demo data.",
  "Requires ADMIN_USER_ID: the id of an existing admin user (used as createdBy).",
].join("\n");

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/**
 * Checks what the seed needs before touching the database. Returns null when it may run,
 * or { error, usage } (usage: print SEED_USAGE). `adminUser` is the ADMIN_USER_ID user:
 * undefined = not looked up yet (only argv/env are checked), null = not found.
 */
export function checkSeedPreconditions({ argv = [], env = {}, adminUser } = {}) {
  if (!argv.includes("--yes")) {
    return { error: "Refusing to run without --yes: the seed deletes data.", usage: true };
  }
  if (!env.MONGODB_URI || !env.MONGODB_DB_NAME) {
    return { error: "MONGODB_URI and/or MONGODB_DB_NAME are missing", usage: false };
  }
  if (!env.ADMIN_USER_ID || !OBJECT_ID_PATTERN.test(env.ADMIN_USER_ID)) {
    return { error: "ADMIN_USER_ID is missing or is not a valid id", usage: false };
  }
  if (adminUser === undefined) return null;
  if (!adminUser) return { error: "ADMIN_USER_ID does not match any user", usage: false };
  if (adminUser.role !== "admin") return { error: "ADMIN_USER_ID is not an admin user", usage: false };
  return null;
}

// ---------- Scenario ----------

const COURSES = {
  A: {
    title: "Meta Ads desde cero",
    short_description: "Armá, lanzá y optimizá tus primeras campañas en Meta Ads paso a paso.",
    full_description:
      "Un recorrido práctico por el Administrador de anuncios: estructura de la cuenta, públicos, " +
      "creatividades y optimización del presupuesto. Cada clase termina con un ejercicio sobre tu propia cuenta.",
    duration: 90,
    classes: [
      ["Estructura de una cuenta publicitaria", "Campañas, conjuntos de anuncios y anuncios: cómo se organizan."],
      ["Públicos y segmentación", "Públicos guardados, personalizados y similares."],
      ["Creatividades que convierten", "Formatos, textos y pruebas A/B de anuncios."],
      ["Optimización y presupuesto", "Cuándo escalar, cuándo pausar y cómo leer los resultados."],
    ],
  },
  B: {
    title: "Contenido para Instagram que vende",
    short_description: "Planificá contenido con objetivos claros y medí qué funciona.",
    full_description:
      "Definí los pilares de tu marca, producí reels y carruseles con un calendario editorial realista " +
      "y aprendé a leer las métricas que importan para vender más.",
    duration: 60,
    classes: [
      ["Pilares de contenido", "Qué contar y a quién, según tus objetivos de negocio."],
      ["Reels y formatos", "Guiones, ganchos y edición rápida desde el celular."],
      ["Calendario editorial", "Frecuencia, reutilización de contenido y organización semanal."],
      ["Métricas de contenido", "Alcance, guardados y conversiones: qué mirar y qué ignorar."],
    ],
  },
  C: {
    title: "Analítica de campañas con Meta",
    short_description: "Medí conversiones de punta a punta con el píxel y la API de conversiones.",
    full_description:
      "Configurá el píxel y la API de conversiones, entendé los modelos de atribución y armá " +
      "reportes que tu equipo o tus clientes puedan leer sin ayuda.",
    duration: 120,
    classes: [
      ["Píxel y API de conversiones", "Instalación, verificación de eventos y deduplicación."],
      ["Eventos y atribución", "Ventanas de atribución y cómo afectan a los resultados."],
      ["Reportes que se entienden", "Columnas personalizadas, desgloses y paneles."],
    ],
  },
};

// Per edition: class days (relative to the seed day; null = no date), price, capacity,
// status and enrollments [demo user index | "own", paymentStatus, review?]
const EDITIONS = [
  {
    course: "A", days: [-150, -143, -136, -129], price: 25000, max: 20, status: "published",
    enrollments: [
      [0, "paid", [5, "Muy claro y práctico, salí con mi primera campaña andando."]],
      [1, "paid", [4, "Buen ritmo. Me hubiera gustado una clase más de creatividades."]],
      [2, "paid", [5, "Excelente, la parte de públicos me cambió la forma de segmentar."]],
      [3, "paid", [4, ""]],
      [4, "paid", [3, "Bien, aunque algunos temas los conocía."]],
      [5, "paid"],
      [6, "pending"],
    ],
  },
  {
    course: "A", days: [-60, -53, -46, -39], price: 30000, max: 20, status: "published",
    enrollments: [
      [1, "paid", [5, "Volví para la segunda edición y valió la pena: mucho contenido nuevo."]],
      [3, "paid", [4, "Muy buena la clase de optimización."]],
      [5, "paid", [5, "Lo recomiendo, los ejercicios sobre la cuenta propia son lo mejor."]],
      [6, "paid"],
      [7, "paid", [4, "Muy completo."]],
      [2, "pending"],
      // Paid without review, so the own account can try leaving one
      ["own", "paid"],
    ],
  },
  {
    course: "A", days: [14, 21, 28, 35], price: 35000, max: 12, status: "published",
    enrollments: [
      [0, "paid"],
      [2, "paid"],
      [4, "pending"],
      [7, "pending"],
      ["own", "pending"],
    ],
  },
  {
    course: "B", days: [-95, -88, -81, -74], price: 18000, max: null, status: "published",
    enrollments: [
      [0, "paid", [4, "Me ordenó muchísimo la planificación."]],
      [1, "paid"],
      [2, "paid", [5, "Las ideas para reels son oro."]],
      [3, "paid", [3, "Correcto, esperaba más ejemplos de cuentas chicas."]],
      [6, "paid", [5, "Súper recomendable."]],
      [7, "paid"],
    ],
  },
  {
    course: "B", days: [-8, -1, 6, 13], price: 20000, max: 25, status: "published",
    enrollments: [
      [1, "paid"],
      [4, "paid"],
      [5, "paid"],
      [2, "pending"],
      ["own", "paid"],
    ],
  },
  {
    course: "C", days: [null, null, null], price: 22000, max: 10, status: "draft",
    enrollments: [],
  },
];

// Standalone free classes: [day, title, description, capacity, participants]
const STANDALONE_CLASSES = [
  [3, "Masterclass: auditá tu cuenta publicitaria", "Revisamos en vivo cuentas reales y sus errores frecuentes.", 30, [0, 3, "own"]],
  [10, "Q&A abierto de Meta Ads", "Traé tus dudas sobre campañas, píxel o facturación.", null, [1]],
  [-20, "Errores comunes en campañas", "Los diez errores que más presupuesto queman y cómo evitarlos.", 25, [0, 2, 5, "own"]],
];

/**
 * Builds the demo documents (with their _id) relative to `now`. `demoUsers` are the
 * inserted DEMO_USERS in the same order ({ _id, first_name }); `ownUserId` is the
 * OWN_USER_EMAIL user id, or null to leave that account out.
 * Returns { courses, courseEditions, classes, courseEnrollments, reviews }.
 */
export function buildSeedData({ now = new Date(), adminId, ownUserId = null, demoUsers }) {
  if (!demoUsers || demoUsers.length < DEMO_USERS.length) {
    throw new Error(`buildSeedData needs the ${DEMO_USERS.length} demo users`);
  }
  // Classes start at 22:00 UTC (19:00 in Buenos Aires) on days relative to the seed day
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 22);
  const at = (day) => new Date(base + day * DAY);
  const nowTime = now.getTime();
  const userOf = (who) => (who === "own" ? (ownUserId ? { _id: ownUserId } : null) : demoUsers[who]);

  const courseIds = Object.fromEntries(Object.keys(COURSES).map((key) => [key, new ObjectId()]));
  const firstDay = (key) =>
    Math.min(...EDITIONS.filter((e) => e.course === key).flatMap((e) => e.days.filter((d) => d !== null)), 0);

  const courses = Object.entries(COURSES).map(([key, { title, short_description, full_description }]) => {
    const createdAt = new Date(Math.min(at(firstDay(key) - 30).getTime(), nowTime - 2 * DAY));
    return {
      _id: courseIds[key],
      title,
      short_description,
      full_description,
      status: "active",
      createdBy: adminId,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const courseEditions = [];
  const classes = [];
  const courseEnrollments = [];
  const reviews = [];

  for (const edition of EDITIONS) {
    const course = COURSES[edition.course];
    const editionId = new ObjectId();
    const dated = edition.days.filter((d) => d !== null);
    const start = dated.length ? at(Math.min(...dated)).getTime() : null;
    const end = dated.length ? at(Math.max(...dated)).getTime() + course.duration * 60000 : null;
    const createdAt = new Date(start === null ? nowTime - 2 * DAY : Math.min(start - 30 * DAY, nowTime - DAY));

    courseEditions.push({
      _id: editionId,
      courseId: courseIds[edition.course],
      price: edition.price,
      max_participants: edition.max,
      status: edition.status,
      createdBy: adminId,
      createdAt,
      updatedAt: createdAt,
    });

    edition.days.forEach((day, i) => {
      const [title, short_description] = course.classes[i];
      classes.push({
        _id: new ObjectId(),
        title,
        short_description,
        duration: course.duration,
        start_date: day === null ? null : at(day),
        price: 0,
        max_participants: null,
        status: "enrolled", // course classes take their participants from the edition enrollments
        type: "class",
        editionId,
        resources: [],
        createdBy: adminId,
        createdAt,
        updatedAt: createdAt,
      });
    });

    edition.enrollments.forEach(([who, paymentStatus, review], i) => {
      const user = userOf(who);
      if (!user) return; // own account missing: its enrollments are skipped
      // Enrolled before the edition started (upcoming editions: in the last days)
      const enrolledAt = start !== null && start < nowTime ? start - (i + 5) * DAY : nowTime - (i + 1) * 26 * HOUR;
      courseEnrollments.push({
        _id: new ObjectId(),
        userId: user._id,
        editionId,
        paymentStatus,
        ...(paymentStatus === "paid" ? { paidAt: new Date(enrolledAt + DAY) } : {}),
        createdAt: new Date(enrolledAt),
        updatedAt: new Date(paymentStatus === "paid" ? enrolledAt + DAY : enrolledAt),
      });
      if (review) {
        const [rating, comment] = review;
        const reviewedAt = new Date(end + (i + 1) * DAY);
        reviews.push({
          _id: new ObjectId(),
          courseId: courseIds[edition.course],
          editionId,
          userId: user._id,
          rating,
          comment,
          firstName: user.first_name,
          createdAt: reviewedAt,
          updatedAt: reviewedAt,
        });
      }
    });
  }

  for (const [day, title, short_description, max_participants, participants] of STANDALONE_CLASSES) {
    const createdAt = new Date(Math.min(at(day - 14).getTime(), nowTime - DAY));
    classes.push({
      _id: new ObjectId(),
      title,
      short_description,
      duration: 60,
      start_date: at(day),
      price: 0,
      max_participants,
      status: "published",
      type: "class",
      participants: participants.map(userOf).filter(Boolean).map((user) => user._id),
      resources: [],
      createdBy: adminId,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return { courses, courseEditions, classes, courseEnrollments, reviews };
}
