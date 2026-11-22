import { IS_DESKTOP_BUILD } from "../config";

// A player who joins a LAN game from the desktop app arrives on the host's
// server with ?home=<their own app's game address>&name=<their name>. Main
// Menu, and the host closing the game, take them back home; the name is
// suggested on the host's sign-in screen. Guests in a web browser, and the
// web build, get no such parameters.
const HOME_PARAM = "home";
const NAME_PARAM = "name";
const STORAGE_KEY = "homeUrl";

// Only the app's own server on this computer, never an arbitrary site
function toHomeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return url.protocol === "http:" && isLoopback ? url.origin : null;
  } catch {
    return null;
  }
}

// Reads and removes the app's parameters from the address bar
function takeParams(): { home: string | null; name: string | null } {
  const params = new URLSearchParams(window.location.search);
  const home = params.get(HOME_PARAM);
  const name = params.get(NAME_PARAM);
  if (home !== null || name !== null) {
    params.delete(HOME_PARAM);
    params.delete(NAME_PARAM);
    const query = params.toString();
    history.replaceState(
      history.state,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
  }
  return { home, name };
}

function readHomeUrl(fromQuery: string | null): string | null {
  const fromQueryOrigin = fromQuery ? toHomeOrigin(fromQuery) : null;
  try {
    if (fromQueryOrigin) {
      // Kept for the window's lifetime: the parameter is gone after the
      // first in-app navigation
      sessionStorage.setItem(STORAGE_KEY, fromQueryOrigin);
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const storedOrigin = stored ? toHomeOrigin(stored) : null;
    // Never "home" to the page's own server: that is where the player is
    return storedOrigin !== window.location.origin ? storedOrigin : null;
  } catch {
    // Storage blocked: offer the way back only on this first page
    return fromQueryOrigin;
  }
}

// Read once at startup, before the router takes over the URL
const params = IS_DESKTOP_BUILD ? takeParams() : { home: null, name: null };

export const HOME_URL: string | null = IS_DESKTOP_BUILD
  ? readHomeUrl(params.home)
  : null;

/** The name the player uses at home, suggested when signing in on a host. */
export const SUGGESTED_NAME: string | null = params.name;

// Leaves a LAN host for the player's own games in the desktop app
export function goHome(): void {
  if (HOME_URL) {
    window.location.href = `${HOME_URL}/sessions`;
  }
}

// Opens a LAN host's game, remembering this server as the way back.
// `name` is the player's name here, suggested for signing in there.
export function goToHost(hostOrigin: string, name?: string): void {
  const query = new URLSearchParams({ [HOME_PARAM]: window.location.origin });
  if (name) {
    query.set(NAME_PARAM, name);
  }
  window.location.href = `${hostOrigin}/?${query.toString()}`;
}
