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
  /** Sign in with just a name (desktop app and LAN play). */
  name: boolean;
}

/** Response of name sign-in. */
export interface ITokenResponse {
  token: string;
  user: IUserData;
}
