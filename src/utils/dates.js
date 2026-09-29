// Date formatting in the app's time zone.
// Dates are stored in UTC; they must always be displayed in Argentina time, both in
// the browser (whatever the user's device zone) and on the server (Vercel runs in UTC,
// which used to shift the times in reminder emails by 3 hours).

export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";
const LOCALE = "es-AR";

const formatters = new Map();
function getParts(date, options) {
  const key = JSON.stringify(options);
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, ...options }),
    );
  }
  return Object.fromEntries(
    formatters
      .get(key)
      .formatToParts(new Date(date))
      .map((p) => [p.type, p.value]),
  );
}

const isValid = (date) =>
  date !== null && date !== undefined && !Number.isNaN(new Date(date).getTime());

/** 30/09/2026 */
export function formatDate(date) {
  if (!isValid(date)) return "—";
  const p = getParts(date, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${p.day}/${p.month}/${p.year}`;
}

/** 18:30 */
export function formatTime(date) {
  if (!isValid(date)) return "—";
  const p = getParts(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}

/** 30/09/2026, 18:30 */
export function formatDateTime(date) {
  if (!isValid(date)) return "—";
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** martes, 30/09/2026, 18:30 */
export function formatWeekdayDateTime(date) {
  if (!isValid(date)) return "—";
  const { weekday } = getParts(date, { weekday: "long" });
  return `${weekday}, ${formatDateTime(date)}`;
}

/** 30/09/2026 a las 18:30 */
export function formatDateAtTime(date) {
  if (!isValid(date)) return "—";
  return `${formatDate(date)} a las ${formatTime(date)}`;
}

/** martes 30 de septiembre de 2026 a las 18:30 (emails) */
export function formatLongDateAtTime(date) {
  if (!isValid(date)) return "—";
  const p = getParts(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${p.weekday} ${p.day} de ${p.month} de ${p.year} a las ${formatTime(date)}`;
}
