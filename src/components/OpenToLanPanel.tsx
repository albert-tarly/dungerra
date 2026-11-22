import React, { useState } from "react";
import { DEFAULT_LAN_PORT, ILanStatus, LanManager } from "../api/LanManager";

const STORAGE_PORT = "lanPort";

function loadPort(): string {
  try {
    return localStorage.getItem(STORAGE_PORT) ?? String(DEFAULT_LAN_PORT);
  } catch {
    return String(DEFAULT_LAN_PORT);
  }
}

function savePort(port: number): void {
  try {
    localStorage.setItem(STORAGE_PORT, String(port));
  } catch {
    // Storage unavailable; nothing to remember
  }
}

interface IOpenToLanPanelProps {
  sessionId: string;
  lan: ILanStatus;
  onChange: (status: ILanStatus) => void;
}

// Game menu, desktop app: opens this game to players on the network
export const OpenToLanPanel: React.FC<IOpenToLanPanelProps> = ({
  sessionId,
  lan,
  onChange,
}) => {
  const [port, setPort] = useState(loadPort);
  const [googleOnly, setGoogleOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isOpen = lan.open && lan.session_id === sessionId;

  const run = async (action: () => Promise<ILanStatus>) => {
    setBusy(true);
    setError("");
    try {
      onChange(await action());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(port);
    void run(async () => {
      const status = await LanManager.open(
        sessionId,
        value,
        googleOnly && lan.google_available === true,
      );
      savePort(value);
      return status;
    });
  };

  if (isOpen) {
    const addresses = lan.addresses?.length
      ? lan.addresses
      : [`(no network found) port ${lan.port}`];
    return (
      <div className="lan-panel">
        <p>Open to LAN. Players join at:</p>
        <ul className="lan-addresses">
          {addresses.map((address) => (
            <li key={address}>{address}</li>
          ))}
        </ul>
        <p className="lan-hint">
          {lan.google_only
            ? "Google sign-in only: they choose Join LAN Game in their Dungerra app and sign in with Google."
            : "They choose Join LAN Game in their game list, or open the address in a web browser."}{" "}
          Leaving this game closes it and disconnects them.
        </p>
        <div className="modal-buttons">
          <button
            className="button-secondary"
            disabled={busy}
            onClick={() => void run(() => LanManager.close())}
          >
            Stop Hosting
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <form className="lan-panel" onSubmit={handleOpen}>
      <p>Let players on your network join this game.</p>
      <div className="lan-open-row">
        <label>
          Port
          <input
            type="number"
            min={1024}
            max={65535}
            required
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          Open to LAN
        </button>
      </div>
      {lan.google_available && (
        <label className="lan-checkbox">
          <input
            type="checkbox"
            checked={googleOnly}
            onChange={(e) => setGoogleOnly(e.target.checked)}
          />
          Google sign-in only (players need the app and a Google account)
        </label>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  );
};
