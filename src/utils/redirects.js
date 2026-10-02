const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Only same-site paths are accepted as "where to go after logging in", so a crafted
 * link can't send the user to another site (open redirect). Anything else falls back
 * to the dashboard.
 */
export function safeCallbackUrl(value) {
  if (typeof value !== "string") return DEFAULT_AFTER_LOGIN;
  // "/x" yes; "//evil.com", "/\evil.com" and "https://…" no
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return value;
}

/** Login page that comes back to `path` afterwards. */
export const loginUrl = (path) => `/login?callbackUrl=${encodeURIComponent(path)}`;

/** The callbackUrl of the current page's query string (browser only). */
export const currentCallbackUrl = () =>
  safeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl"));
