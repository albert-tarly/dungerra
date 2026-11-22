import React, { useEffect, useRef, useState } from "react";
import { AuthManager } from "../api/AuthManager";
import { LanManager } from "../api/LanManager";
import { goToHost } from "../utils/home";

const STORAGE_ADDRESS = "lanJoinAddress";

function loadAddress(): string {
  try {
    return localStorage.getItem(STORAGE_ADDRESS) ?? "";
  } catch {
    return "";
  }
}

function saveAddress(address: string): void {
  try {
    localStorage.setItem(STORAGE_ADDRESS, address);
  } catch {
    // Storage unavailable; nothing to remember
  }
}

interface IJoinLanModalProps {
  onCancel: () => void;
}

// Game list, desktop app: joins a game another player opened to LAN
export const JoinLanModal: React.FC<IJoinLanModalProps> = ({ onCancel }) => {
  const [address, setAddress] = useState(loadAddress);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // A Google sign-in in the system browser, for a Google-only game
  const googleWait = useRef<AbortController | null>(null);
  useEffect(() => () => googleWait.current?.abort(), []);

  const handleCancel = () => {
    googleWait.current?.abort();
    onCancel();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const origin = await LanManager.probe(address);
      saveAddress(address.trim());
      const challenge = await LanManager.challenge(origin);
      const authManager = AuthManager.getInstance();

      if (challenge.google_only && challenge.nonce) {
        // Prove a Google identity to the host: sign in with Google here, with
        // the host's one-time nonce, and take the ID token there
        const providers = await authManager.getProviders();
        if (providers.google_flow !== "loopback") {
          throw new Error(
            "This game accepts Google sign-in only, which this app can't do.",
          );
        }
        const controller = new AbortController();
        googleWait.current = controller;
        const state = await authManager.startGoogleSignIn(challenge.nonce);
        setStatus(
          "This game accepts Google sign-in only. Finish signing in with Google in your browser…",
        );
        const result = await authManager.waitForGoogleSignIn(
          state,
          controller.signal,
        );
        if (!result.id_token) {
          throw new Error("Google sign-in failed. Please try again.");
        }
        goToHost(origin, { googleIdToken: result.id_token });
        return;
      }

      // The host's server delivers its own game client. A name account's
      // name is suggested there (not a Google name: the name must be one
      // name sign-in accepts).
      const user = authManager.getUserData();
      goToHost(origin, {
        name: user?.provider === "local" ? user.username : undefined,
      });
    } catch (err) {
      if (!googleWait.current?.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
      setStatus("");
      setBusy(false);
    }
  };

  return (
    <div className="modal show" role="dialog" aria-modal="true">
      <form className="modal-content" onSubmit={(e) => void handleJoin(e)}>
        <h2>Join LAN Game</h2>
        <p className="game-menu-note">
          Enter the address the host sees in their game menu.
        </p>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="192.168.1.5:8080"
          autoComplete="off"
          spellCheck={false}
          required
          autoFocus
          aria-label="Host address"
        />
        <div className="modal-buttons">
          <button
            type="button"
            className="button-secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            {busy ? "Joining…" : "Join"}
          </button>
        </div>
        {status && <p className="game-menu-note lan-join-status">{status}</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};
