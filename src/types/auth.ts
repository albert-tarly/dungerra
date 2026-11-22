export interface IAuthManager {
  getAuthUrl(): Promise<string>;
  checkAuthStatus(token: string): Promise<IUserData>;
}

export type AuthProvider = "google" | "local";

export interface IUserData {
  id: string;
  provider: AuthProvider;
  username: string;
  /** Name shown to other players; name accounts carry an "@local" suffix. */
  display_name: string;
  email?: string;
  is_active: boolean;
  current_session: string;
}

export interface IAuthResponse {
  url: string;
}

/** Sign-in options enabled on the server (GET /auth/providers). */
export interface IAuthProviders {
  google: boolean;
  /**
   * "redirect" (web: Google returns to this page) or "loopback" (desktop app:
   * sign-in happens in the system browser, and the page polls for the result).
   */
  google_flow?: "redirect" | "loopback";
  /** Sign in with just a name (desktop app and LAN play). */
  name: boolean;
}

/** A finished loopback Google sign-in (GET /auth/google/result). */
export interface IGoogleLoopbackResult {
  token: string;
  user: IUserData;
  /** Only when the sign-in carried a LAN host's nonce. */
  id_token?: string;
}

/** Response of name sign-in. */
export interface ITokenResponse {
  token: string;
  user: IUserData;
}
