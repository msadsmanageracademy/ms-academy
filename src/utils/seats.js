// Seat availability for classes and courses (pure, shared by server and client).

export const LOW_SEATS_THRESHOLD = 3;

/**
 * Describes how many seats are left.
 * A missing or non-positive `max` means the activity has no seat limit.
 * @param {number|null|undefined} taken
 * @param {number|null|undefined} max
 * @returns {{ unlimited: boolean, full: boolean, low: boolean, remaining: number|null, percentage: number|null, label: string }}
 */
export function getSeatsInfo(taken, max) {
  const used = Number.isFinite(taken) && taken > 0 ? Math.floor(taken) : 0;
  if (!(Number.isFinite(max) && max > 0)) {
    return {
      unlimited: true,
      full: false,
      low: false,
      remaining: null,
      percentage: null,
      label: "Cupo ilimitado",
    };
  }

  const remaining = Math.max(0, max - used);
  const percentage = Math.min(100, Math.round((used / max) * 100));
  const base = { unlimited: false, full: false, low: false, remaining, percentage };

  if (remaining === 0) return { ...base, full: true, label: "Cupo completo" };
  if (remaining <= LOW_SEATS_THRESHOLD) {
    return {
      ...base,
      low: true,
      label: remaining === 1 ? "Último lugar" : `Últimos ${remaining} lugares`,
    };
  }
  return { ...base, label: `Quedan ${remaining} lugares` };
}
