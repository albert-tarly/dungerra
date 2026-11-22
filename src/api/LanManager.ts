import { API_BASE_URL, IS_DESKTOP_BUILD } from "../config";
import { HttpClient } from "./HttpClient";

// "Open to LAN" in the desktop app (dungerra-api /api/v1/lan). The app's own
// server answers with role "local"; a LAN host answers its guests with
// role "guest". Web servers have no such endpoint.
export interface ILanStatus {
  role: "local" | "guest";
  open: boolean;
  session_id?: string;
  session_name?: string;
  port?: number;
  addresses?: string[]; // host:port others join at
}

export const DEFAULT_LAN_PORT = 8080;
const PROBE_TIMEOUT_MS = 4000;

export class LanManager {
  /** null when the server has no LAN support (the web version). */
  static async getStatus(): Promise<ILanStatus | null> {
    if (!IS_DESKTOP_BUILD) {
      return null;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/lan`);
      return response.ok ? ((await response.json()) as ILanStatus) : null;
    } catch {
      return null;
    }
  }

  static async open(sessionId: string, port: number): Promise<ILanStatus> {
    return HttpClient.post<ILanStatus>("/lan", { session_id: sessionId, port });
  }

  static async close(): Promise<ILanStatus> {
    return HttpClient.delete<ILanStatus>("/lan");
  }

  /**
   * Checks that a Dungerra game answers at a host address such as
   * "192.168.1.5:8080" and returns its origin. Throws a message for players.
   */
  static async probe(address: string): Promise<string> {
    const origin = parseHostAddress(address);
    if (!origin) {
      throw new Error(
        `"${address.trim()}" is not an address. Enter it like 192.168.1.5:8080.`,
      );
    }
    try {
      const response = await fetch(`${origin}/api/v1/version`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const body = (await response.json()) as { game_version?: unknown };
      if (typeof body.game_version !== "string") {
        throw new Error("not a Dungerra server");
      }
    } catch {
      throw new Error(
        `No game found at ${origin.replace(/^http:\/\//, "")}. Check the address, and ask the host to open their game to LAN.`,
      );
    }
    return origin;
  }
}

/**
 * "192.168.1.5:8080", "192.168.1.5" (port 8080) or "http://192.168.1.5:8080/"
 * to "http://192.168.1.5:8080". null if it is not a usable address.
 */
export function parseHostAddress(input: string): string | null {
  let text = input.trim();
  if (!text) {
    return null;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    text = `http://${text}`;
  }
  try {
    const url = new URL(text);
    // LAN hosts serve plain http
    if (url.protocol !== "http:" || !url.hostname) {
      return null;
    }
    if (!url.port) {
      url.port = String(DEFAULT_LAN_PORT);
    }
    return url.origin;
  } catch {
    return null;
  }
}
