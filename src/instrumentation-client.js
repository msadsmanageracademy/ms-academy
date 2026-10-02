// Runs in the browser before the app hydrates (Next.js client instrumentation)
import { startNavigation } from "@/lib/navigationProgress";

// Called on every client navigation (Link click, router.push/replace, back/forward),
// before the new route is requested: gives instant feedback while the server answers
export function onRouterTransitionStart(url) {
  startNavigation(url);
}
