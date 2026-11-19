import { API_BASE_URL } from '../config';
import { IAuthProviders, ITokenResponse, IUserData } from '../types/auth';

const TOKEN_STORAGE_KEY = 'token';

/** Used when the server predates /auth/providers (Google-only servers). */
const LEGACY_PROVIDERS: IAuthProviders = { google: true, local: false };

export class AuthManager {
    private static instance: AuthManager;
    private userData: IUserData | null = null;
    private authUrl: string | null = null;
    private performingRequest: boolean = false;
    private _token: string | null = null;

    private readonly urls = {
        login: '/auth/google/url',
        user: '/auth/user',
        providers: '/auth/providers',
        localLogin: '/auth/local/login',
        localRegister: '/auth/local/register',
    };

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
            const response = await fetch(API_BASE_URL + url, {
                method: 'GET',
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${this.getToken()}`
                }
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error('Request failed: ', error);
            throw error;
        } finally {
            this.performingRequest = false;
        }
    }

    initToken(): void {
        const queryParams = new URLSearchParams(window.location.search);
        let token = queryParams.get('token');
    
        if (token) {
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
            history.pushState({}, '', window.location.pathname);
        } else {
            token = localStorage.getItem(TOKEN_STORAGE_KEY);
        }

        this._token = token;
    }

    private setToken(token: string): void {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        this._token = token;
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
        return response.json();
    }

    /** Signs in with a local account. Throws an Error with a user-facing message on failure. */
    async loginLocal(username: string, password: string): Promise<IUserData> {
        return this.submitLocalCredentials(this.urls.localLogin, username, password);
    }

    /** Creates a local account and signs in. Throws an Error with a user-facing message on failure. */
    async registerLocal(username: string, password: string): Promise<IUserData> {
        return this.submitLocalCredentials(this.urls.localRegister, username, password);
    }

    private async submitLocalCredentials(url: string, username: string, password: string): Promise<IUserData> {
        this.performingRequest = true;
        try {
            const response = await fetch(API_BASE_URL + url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                // The server returns short, user-facing plain-text messages
                // (validation rules, "username is already taken", ...).
                const message = (await response.text()).trim();
                throw new Error(message ? capitalize(message) : `Request failed (${response.status})`);
            }

            const { token, user } = (await response.json()) as ITokenResponse;
            this.setToken(token);
            this.userData = user;
            return user;
        } finally {
            this.performingRequest = false;
        }
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
