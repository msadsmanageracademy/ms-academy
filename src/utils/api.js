import { closeLoading, toastError, toastLoading, toastSuccess } from "@/utils/alerts";

/**
 * fetch() for the app API. Sends `body` as JSON and returns the parsed response
 * envelope plus the HTTP result: { ok, status, success, message, data, ... }.
 * Network failures reject (like fetch).
 */
export async function apiRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    // empty or non-JSON body
  }
  return { ...json, ok: res.ok, status: res.status };
}

/**
 * Runs a mutation with the usual feedback: loading toast, then a success toast or
 * an error toast with the server message (or `failure` when there is none).
 * `request` may call the REST API (apiRequest) or a Server Action: both resolve to
 * { ok, message, data, ... }.
 *
 * - loading: [title, text] (optional)
 * - success: [title, text, timer?] or (response) => [title, text, timer?] (optional)
 * - onError: (response) => true when it handled the error itself (no error toast)
 *
 * Returns the response when it succeeded, otherwise null.
 */
export async function runApiAction({ loading, request, success, failure, onError }) {
  if (loading) toastLoading(...loading);
  try {
    const res = await request();
    if (loading) closeLoading();
    if (!res.ok) {
      if (!onError?.(res)) toastError(3000, "Ha habido un error", res.message || failure);
      return null;
    }
    if (success) {
      const [title, text, timer = 3000] = typeof success === "function" ? success(res) : success;
      toastSuccess(timer, title, text);
    }
    return res;
  } catch (error) {
    if (loading) closeLoading();
    console.error(failure, error);
    toastError(3000, "Ha habido un error", failure);
    return null;
  }
}
