import { useCallback, useEffect, useState } from "react";
import { ILanStatus, LanManager } from "../api/LanManager";

/**
 * The server's "Open to LAN" status: null until loaded, and on servers
 * without LAN support. refresh() reloads it.
 */
export function useLanStatus(): {
  lan: ILanStatus | null;
  setLan: (status: ILanStatus) => void;
  refresh: () => Promise<void>;
} {
  const [lan, setLan] = useState<ILanStatus | null>(null);

  const refresh = useCallback(async () => {
    const status = await LanManager.getStatus();
    setLan(status);
  }, []);

  useEffect(() => {
    let alive = true;
    void LanManager.getStatus().then((status) => {
      if (alive) {
        setLan(status);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return { lan, setLan, refresh };
}
