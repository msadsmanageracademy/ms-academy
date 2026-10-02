export const APPEAR_DELAY_MS = 120;
// Time the bar takes to fill and fade out once the new page is rendered
export const FINISH_MS = 350;
// A navigation that never changes the URL (e.g. redirected back to the same page)
// must not leave the bar running forever
export const SAFETY_TIMEOUT_MS = 15000;

let phase = "idle";
let startedAt = 0;
let timer = null;
const listeners = new Set();

function setPhase(next) {
  phase = next;
  listeners.forEach((listener) => listener());
}

function schedule(fn, ms) {
  clearTimeout(timer);
  timer = setTimeout(fn, ms);
}

/** Same page (at most the hash differs): the router doesn't render anything new. */
function isSamePage(href) {
  const target = new URL(href, window.location.href);
  return (
    target.origin === window.location.origin &&
    target.pathname === window.location.pathname &&
    target.search === window.location.search
  );
}

export function startNavigation(href) {
  if (isSamePage(href)) return;
  if (phase !== "loading") startedAt = performance.now();
  schedule(finishNavigation, SAFETY_TIMEOUT_MS);
  setPhase("loading");
}

export function finishNavigation() {
  if (phase !== "loading") return;
  // Never became visible: nothing to complete
  if (performance.now() - startedAt < APPEAR_DELAY_MS) {
    clearTimeout(timer);
    setPhase("idle");
    return;
  }
  schedule(() => setPhase("idle"), FINISH_MS);
  setPhase("finishing");
}

export const getNavigationPhase = () => phase;

export function subscribeNavigation(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
