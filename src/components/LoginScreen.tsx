import React, { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthManager } from "../api/AuthManager";
import { useAuth } from "../contexts/AuthContext";
import { IAuthProviders } from "../types/auth";
import { SUGGESTED_NAME } from "../utils/home";
import { useLanStatus } from "../utils/useLanStatus";

// Mirrors the server rules so obvious mistakes are caught before a round-trip;
// the server remains the source of truth and returns its own messages.
const NAME_MIN = 3;
const NAME_MAX = 24;
const NAME_PATTERN = "[A-Za-z0-9_.\\-]+";

export const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const authManager = AuthManager.getInstance();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  // A sign-in the page arrived with (e.g. a Google token for this host) may
  // have failed; say why
  const [error, setError] = useState(
    () => authManager.takePendingSignInError() ?? "",
  );
  const [providers, setProviders] = useState<IAuthProviders | null>(null);

  // A player joining from the desktop app arrives with their own name
  const [name, setName] = useState(SUGGESTED_NAME ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Desktop app: a LAN guest can't use Google here (Google can't return to a
  // LAN address), and a Google-only game takes no names
  const { lan } = useLanStatus();
  const isLanGuest = lan?.role === "guest";
  const googleOnlyGuest = isLanGuest && lan.google_only === true;
  const showGoogle = providers?.google === true && !isLanGuest;
  const showName = providers?.name === true && !googleOnlyGuest;

  // Loopback Google sign-in in progress (finishing in the system browser)
  const [waitingForGoogle, setWaitingForGoogle] = useState(false);
  const googleWait = useRef<AbortController | null>(null);
  useEffect(() => () => googleWait.current?.abort(), []);

  useEffect(() => {
    // If already authenticated, redirect to sessions
    if (!isLoading && isAuthenticated) {
      void navigate("/sessions", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    authManager
      .getProviders()
      .then(setProviders)
      .catch(() => setError("Failed to reach the server. Please refresh."));
  }, [authManager]);

  const handleGoogleLogin = async () => {
    if (authManager.isPerformingRequest()) {
      return;
    }

    if (providers?.google_flow === "loopback") {
      await handleGoogleLoopback();
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

  // Desktop app: sign in with Google in the system browser, then collect it
  const handleGoogleLoopback = async () => {
    googleWait.current?.abort();
    const controller = new AbortController();
    googleWait.current = controller;
    setError("");
    setWaitingForGoogle(true);
    try {
      const state = await authManager.startGoogleSignIn();
      const result = await authManager.waitForGoogleSignIn(
        state,
        controller.signal,
      );
      authManager.applyGoogleSignIn(result);
      await checkAuth();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      }
    } finally {
      if (googleWait.current === controller) {
        setWaitingForGoogle(false);
      }
    }
  };

  const cancelGoogle = () => {
    googleWait.current?.abort();
    setWaitingForGoogle(false);
  };

  const handleNameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await authManager.signInWithName(name.trim());
      // Token is stored; let the auth context pick it up (redirects on success).
      await checkAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
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

      {showGoogle && !waitingForGoogle && (
        <div className="button-container">
          <button id="loginButton" onClick={handleGoogleLogin}>
            Login with Google
          </button>
        </div>
      )}

      {waitingForGoogle && (
        <div className="button-container">
          <p className="login-hint">
            Finish signing in with Google in your browser, then come back here.
          </p>
          <button className="button-secondary" onClick={cancelGoogle}>
            Cancel
          </button>
        </div>
      )}

      {googleOnlyGuest && (
        <p className="login-hint">
          This game accepts Google sign-in only. Join it from your own Dungerra
          app (Join LAN Game in the game list) and sign in with Google there.
        </p>
      )}

      {showGoogle && showName && !waitingForGoogle && (
        <p className="login-divider">or</p>
      )}

      {showName && !waitingForGoogle && (
        <form className="login-form" onSubmit={handleNameSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={NAME_MIN}
            maxLength={NAME_MAX}
            pattern={NAME_PATTERN}
            title={`${NAME_MIN}-${NAME_MAX} letters, digits, "_", "-" or "."`}
            required
            autoFocus
          />
          <p className="login-hint">
            Other players see you as{" "}
            <strong>{`${name.trim() || "name"}@local`}</strong>. Use the same
            name to continue your character.
          </p>
          <button type="submit" disabled={isSubmitting}>
            Play
          </button>
        </form>
      )}

      {error && <p className="error login-error">{error}</p>}
    </div>
  );
};
