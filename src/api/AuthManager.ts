import { API_BASE_URL } from "../config";
import {
  IAuthProviders,
  IGoogleLoopbackResult,
  ITokenResponse,
  IUserData,
} from "../types/auth";
import { PENDING_GOOGLE_ID_TOKEN, PENDING_GOOGLE_STATE } from "../utils/home";

const TOKEN_STORAGE_KEY = "token";

// Loopback Google sign-in (desktop app): how often to ask the server whether
// the player finished signing in in their browser, and for how long
const GOOGLE_POLL_INTERVAL_MS = 1500;
const GOOGLE_POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** Used when the server predates /auth/providers (Google-only servers). */
const LEGACY_PROVIDERS: IAuthProviders = { google: true, name: false };

export class AuthManager {
  private static instance: AuthManager;
  private userData: IUserData | null = null;
  private authUrl: string | null = null;
  private performingRequest: boolean = false;
  private _token: string | null = null;

  private readonly urls = {
    login: "/auth/google/url",
    user: "/auth/user",
    providers: "/auth/providers",
    nameSignIn: "/auth/name",
    googleResult: "/auth/google/result",
    googleIdToken: "/auth/google/id-token",
  };

  // A sign-in the page arrived with (a Google ID token for this host, or a
  // Google sign-in finished in this browser), done once at start-up
  private pendingSignIn: Promise<void> | null = null;
  private pendingSignInError: string | null = null;

  private constructor() {}

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private async get<T>(url: string, options: RequestInit = {}): Promise<T> {
    this.performingRequest = true;
    try {
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${this.getToken()}`);
      const response = await fetch(API_BASE_URL + url, {
        method: "GET",
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error("Request failed: ", error);
      throw error;
    } finally {
      this.performingRequest = false;
    }
  }

  initToken(): void {
    const queryParams = new URLSearchParams(window.location.search);
    let token = queryParams.get("token");

    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      history.pushState({}, "", window.location.pathname);
    } else {
      token = localStorage.getItem(TOKEN_STORAGE_KEY);
    }

    this._token = token;
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    this._token = token;
  }

  /**
   * Completes a sign-in the page was opened with, before the stored token is
   * checked: a Google ID token from the player's own app (joining a
   * Google-only LAN game), or a Google sign-in finished in this browser.
   */
  completePendingSignIn(): Promise<void> {
    this.pendingSignIn ??= this.runPendingSignIn();
    return this.pendingSignIn;
  }

  /** Why the sign-in the page arrived with failed, once. */
  takePendingSignInError(): string | null {
    const error = this.pendingSignInError;
    this.pendingSignInError = null;
    return error;
  }

  private async runPendingSignIn(): Promise<void> {
    try {
      if (PENDING_GOOGLE_ID_TOKEN) {
        const response = await fetch(API_BASE_URL + this.urls.googleIdToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: PENDING_GOOGLE_ID_TOKEN }),
        });
        if (!response.ok) {
          throw new Error((await response.text()).trim());
        }
        const { token, user } = (await response.json()) as ITokenResponse;
        this.setToken(token);
        this.userData = user;
      } else if (PENDING_GOOGLE_STATE) {
        const result = await this.waitForGoogleSignIn(PENDING_GOOGLE_STATE);
        this.setToken(result.token);
        this.userData = result.user;
      }
    } catch (err) {
      this.pendingSignInError =
        err instanceof Error && err.message
          ? err.message
          : "Google sign-in failed.";
    }
  }

  /**
   * Starts a Google sign-in in the system browser (loopback flow, desktop
   * app) and returns its state. With a nonce (from a LAN host), the result
   * carries an ID token for that host.
   */
  async startGoogleSignIn(nonce?: string): Promise<string> {
    const query = nonce ? `?nonce=${encodeURIComponent(nonce)}` : "";
    const { url, state } = await this.get<{ url: string; state: string }>(
      this.urls.login + query,
    );
    // The app opens Google's page in the system browser and keeps this page
    // (Google refuses embedded browsers). In a plain browser, this page is
    // replaced; the callback page then links back with the state.
    window.location.assign(url);
    return state;
  }

  /**
   * Waits until the Google sign-in `state` finishes in the browser. Rejects
   * with a message for players, or when `signal` aborts.
   */
  async waitForGoogleSignIn(
    state: string,
    signal?: AbortSignal,
  ): Promise<IGoogleLoopbackResult> {
    const deadline = Date.now() + GOOGLE_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const response = await fetch(
        `${API_BASE_URL}${this.urls.googleResult}?state=${encodeURIComponent(state)}`,
        { signal },
      );
      if (response.status === 200) {
        return (await response.json()) as IGoogleLoopbackResult;
      }
      if (response.status !== 202) {
        const message = (await response.text()).trim();
        throw new Error(message || "Google sign-in failed.");
      }
      await new Promise((resolve) =>
        setTimeout(resolve, GOOGLE_POLL_INTERVAL_MS),
      );
    }
    throw new Error("Google sign-in took too long. Please try again.");
  }

  /** Signs in with a finished loopback Google sign-in. */
  applyGoogleSignIn(result: IGoogleLoopbackResult): void {
    this.setToken(result.token);
    this.userData = result.user;
  }

  /** Returns the sign-in options enabled on the server. */
  async getProviders(): Promise<IAuthProviders> {
    const response = await fetch(API_BASE_URL + this.urls.providers);
    if (response.status === 404) {
      return LEGACY_PROVIDERS;
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as IAuthProviders;
  }

  /**
   * Signs in with just a name, creating its account the first time. Throws an
   * Error with a user-facing message on failure (e.g. the name is in play).
   */
  async signInWithName(name: string): Promise<IUserData> {
    this.performingRequest = true;
    try {
      const response = await fetch(API_BASE_URL + this.urls.nameSignIn, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        // The server returns short, user-facing plain-text messages
        // (validation rules, "<name> is playing right now", ...).
        const message = (await response.text()).trim();
        throw new Error(
          message ? capitalize(message) : `Request failed (${response.status})`,
        );
      }

      const { token, user } = (await response.json()) as ITokenResponse;
      this.setToken(token);
      this.userData = user;
      return user;
    } finally {
      this.performingRequest = false;
    }
  }

  /**
   * Forgets the token locally. The server has no revocation endpoint, so a
   * copied token stays valid until it expires on its own.
   */
  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this._token = null;
    this.userData = null;
    this.authUrl = null;
  }

  getToken(): string | null {
    return this._token;
  }

  async getAuthUrl(): Promise<string> {
    const response = await this.get<{ url: string }>(this.urls.login);
    this.authUrl = response.url;
    return this.authUrl;
  }

  async checkAuthStatus(): Promise<IUserData> {
    const userData = await this.get<IUserData>(this.urls.user);
    this.userData = userData;
    return userData;
  }

  isPerformingRequest(): boolean {
    return this.performingRequest;
  }

  getUserData(): IUserData | null {
    return this.userData;
  }

  openAuthPage(): void {
    if (this.authUrl) {
      window.location.href = this.authUrl;
    }
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
