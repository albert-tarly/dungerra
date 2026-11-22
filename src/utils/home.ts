import { IS_DESKTOP_BUILD } from "../config";

// A player who joins a LAN game from the desktop app arrives on the host's
// server with ?home=<their own app's game address>&name=<their name>. Main
// Menu, and the host closing the game, take them back home; the name is
// suggested on the host's sign-in screen. Guests in a web browser, and the
// web build, get no such parameters.
const HOME_PARAM = "home";
const NAME_PARAM = "name";
// A Google ID token for a "Google sign-in only" host, from the joining
// player's own app (one use; the host checks it carries its nonce)
const GOOGLE_ID_TOKEN_PARAM = "google_id_token";
// A Google sign-in finished in this browser rather than the app (loopback
// flow): the state to collect the result with
const GOOGLE_STATE_PARAM = "google_state";
const APP_PARAMS = [
  HOME_PARAM,
  NAME_PARAM,
  GOOGLE_ID_TOKEN_PARAM,
  GOOGLE_STATE_PARAM,
];
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

type AppParams = Record<string, string | null>;

// Reads and removes the app's parameters from the address bar
function takeParams(): AppParams {
  const params = new URLSearchParams(window.location.search);
  const taken: AppParams = Object.fromEntries(
    APP_PARAMS.map((key) => [key, params.get(key)]),
  );
  if (APP_PARAMS.some((key) => taken[key] !== null)) {
    APP_PARAMS.forEach((key) => params.delete(key));
    const query = params.toString();
    history.replaceState(
      history.state,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
  }
  return taken;
}

const NO_PARAMS: AppParams = Object.fromEntries(
  APP_PARAMS.map((key) => [key, null]),
);

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
const params = IS_DESKTOP_BUILD ? takeParams() : NO_PARAMS;

export const HOME_URL: string | null = IS_DESKTOP_BUILD
  ? readHomeUrl(params[HOME_PARAM])
  : null;

/** The name the player uses at home, suggested when signing in on a host. */
export const SUGGESTED_NAME: string | null = params[NAME_PARAM];

/** A Google ID token to sign in to this host with (Google-only games). */
export const PENDING_GOOGLE_ID_TOKEN: string | null =
  params[GOOGLE_ID_TOKEN_PARAM];

/** A Google sign-in that finished in this browser, to collect. */
export const PENDING_GOOGLE_STATE: string | null = params[GOOGLE_STATE_PARAM];

// Leaves a LAN host for the player's own games in the desktop app
export function goHome(): void {
  if (HOME_URL) {
    window.location.href = `${HOME_URL}/sessions`;
  }
}

// Opens a LAN host's game, remembering this server as the way back. Either
// `name` (the player's name here, suggested for signing in there) or
// `googleIdToken` (for a Google-only game, signs in there directly).
export function goToHost(
  hostOrigin: string,
  signIn: { name?: string; googleIdToken?: string } = {},
): void {
  const query = new URLSearchParams({ [HOME_PARAM]: window.location.origin });
  if (signIn.googleIdToken) {
    query.set(GOOGLE_ID_TOKEN_PARAM, signIn.googleIdToken);
  } else if (signIn.name) {
    query.set(NAME_PARAM, signIn.name);
  }
  window.location.href = `${hostOrigin}/?${query.toString()}`;
}
