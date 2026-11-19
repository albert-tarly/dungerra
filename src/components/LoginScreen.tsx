import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthManager } from "../api/AuthManager";
import { useAuth } from "../contexts/AuthContext";
import { IAuthProviders } from "../types/auth";

type LocalMode = "login" | "register";

// Mirrors the server rules so obvious mistakes are caught before a round-trip;
// the server remains the source of truth and returns its own messages.
const USERNAME_MIN = 3;
const USERNAME_MAX = 24;
const USERNAME_PATTERN = "[A-Za-z0-9_.\\-]+";
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const authManager = AuthManager.getInstance();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<IAuthProviders | null>(null);

  const [mode, setMode] = useState<LocalMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect to sessions
    if (!isLoading && isAuthenticated) {
      navigate("/sessions", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    authManager
      .getProviders()
      .then(setProviders)
      .catch(() => setError("Failed to reach the server. Please refresh."));
  }, []);

  const handleGoogleLogin = async () => {
    if (authManager.isPerformingRequest()) {
      return;
    }

    try {
      setError("");
      await authManager.getAuthUrl();
      authManager.openAuthPage();
    } catch (err) {
      console.error("Authentication failed:", err);
      setError("Authentication failed. Please try again.");
    }
  };

  const handleLocalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (mode === "register" && password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const name = username.trim();
      if (mode === "register") {
        await authManager.registerLocal(name, password);
      } else {
        await authManager.loginLocal(name, password);
      }
      // Token is stored; let the auth context pick it up (redirects on success).
      await checkAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: LocalMode) => {
    setMode(next);
    setError("");
    setPasswordConfirm("");
  };

  if (isLoading || (!providers && !error)) {
    return (
      <div id="loginScreen" className="screen">
        <img className="logo" src="favicon.png" alt="" width="100" />
        <h1>Dungerra</h1>
        <p id="loader">Loading...</p>
      </div>
    );
  }

  return (
    <div id="loginScreen" className="screen">
      <img className="logo" src="favicon.png" alt="" width="100" />
      <h1>Dungerra</h1>

      {providers?.google && (
        <div className="button-container">
          <button id="loginButton" onClick={handleGoogleLogin}>
            Login with Google
          </button>
        </div>
      )}

      {providers?.google && providers.local && (
        <p className="login-divider">or</p>
      )}

      {providers?.local && (
        <form className="login-form" onSubmit={handleLocalSubmit}>
          <div className="tabs">
            <button
              type="button"
              className={`tab-button ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`tab-button ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>

          <input
            type="text"
            name="username"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            pattern={USERNAME_PATTERN}
            title={`${USERNAME_MIN}-${USERNAME_MAX} letters, digits, "_", "-" or "."`}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === "register" ? PASSWORD_MIN : undefined}
            maxLength={PASSWORD_MAX}
            required
          />
          {mode === "register" && (
            <>
              <input
                type="password"
                name="password-confirm"
                placeholder="Repeat password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                maxLength={PASSWORD_MAX}
                required
              />
              <p className="login-hint">
                Other players will see you as{" "}
                <strong>{(username.trim() || "name") + "@local"}</strong>.
              </p>
            </>
          )}

          <button type="submit" disabled={isSubmitting}>
            {mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>
      )}

      {error && <p className="error login-error">{error}</p>}
    </div>
  );
};
