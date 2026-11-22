import React, { useState } from "react";
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
  const [error, setError] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const origin = await LanManager.probe(address);
      saveAddress(address.trim());
      // The host's server delivers its own game client. A name account's
      // name is suggested there (not a Google name: a host may not offer
      // Google, and the name must be one sign-in accepts).
      const user = AuthManager.getInstance().getUserData();
      goToHost(origin, user?.provider === "local" ? user.username : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            {busy ? "Looking…" : "Join"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};
