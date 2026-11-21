import { IS_DESKTOP_BUILD } from "../config";

// The desktop app opens the client with ?launcher=<its launcher page>, so the
// client can offer a way back to it (the app window has no browser controls).
// LAN guests in a browser and the web build get no such parameter.
const LAUNCHER_PARAM = "launcher";
const STORAGE_KEY = "launcherUrl";

// Only the app's own launcher page, never an arbitrary site: Tauri serves it
// from one of these origins depending on the platform
const LAUNCHER_ORIGINS = new Set([
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
]);

function isLauncherUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // Custom schemes report origin "null", so compare scheme and host
    return LAUNCHER_ORIGINS.has(`${url.protocol}//${url.host}`);
  } catch {
    return false;
  }
}

function readLauncherUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(LAUNCHER_PARAM);
  try {
    if (fromQuery && isLauncherUrl(fromQuery)) {
      // Kept for the window's lifetime: the parameter is gone after the
      // first in-app navigation
      sessionStorage.setItem(STORAGE_KEY, fromQuery);
    }
    if (fromQuery !== null) {
      params.delete(LAUNCHER_PARAM);
      const query = params.toString();
      history.replaceState(
        history.state,
        "",
        window.location.pathname + (query ? `?${query}` : ""),
      );
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored && isLauncherUrl(stored) ? stored : null;
  } catch {
    // Storage blocked: offer the way back only on this first page
    return fromQuery && isLauncherUrl(fromQuery) ? fromQuery : null;
  }
}

// Read once at startup, before the router takes over the URL
export const LAUNCHER_URL: string | null = IS_DESKTOP_BUILD
  ? readLauncherUrl()
  : null;

// Leaves the game client for the app's launcher. The app keeps a hosted game
// running; a solo one is saved and stopped.
export function goToLauncher(): void {
  if (LAUNCHER_URL) {
    window.location.href = LAUNCHER_URL;
  }
}
