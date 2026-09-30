// Minimal structured logger (no dependencies).
// - production: one JSON line per entry, ready for the hosting's log search
// - development: readable text
// - tests: only warnings and errors
// Usage: logger.error("Error updating class", error, { classId })

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel = () =>
  LEVELS[process.env.LOG_LEVEL] ??
  (process.env.NODE_ENV === "test" ? LEVELS.warn : process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug);

/** Only name, message, code and stack of an error (never the whole object). */
function serializeError(error) {
  if (!(error instanceof Error)) return error;
  return {
    name: error.name,
    message: error.message,
    ...(error.code !== undefined ? { code: error.code } : {}),
    stack: error.stack,
  };
}

function write(level, message, error, context) {
  if (LEVELS[level] < minLevel()) return;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (process.env.NODE_ENV === "production") {
    sink(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        msg: message,
        ...(context ? { context } : {}),
        ...(error !== undefined ? { err: serializeError(error) } : {}),
      }),
    );
    return;
  }
  const extras = [error, context].filter((value) => value !== undefined);
  sink(`[${level}] ${message}`, ...extras);
}

export const logger = {
  debug: (message, context) => write("debug", message, undefined, context),
  info: (message, context) => write("info", message, undefined, context),
  warn: (message, error, context) => write("warn", message, error, context),
  error: (message, error, context) => write("error", message, error, context),
};
