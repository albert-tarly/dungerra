import * as config from "../config";

export interface IPose {
  x: number;
  y: number;
  rotation: number;
}
type Snapshot = IPose & { time: number };

// Plenty for INTERPOLATION_DELAY_MS at the server tick rate
const MAX_SNAPSHOTS = 16;

function lerpAngle(from: number, to: number, t: number): number {
  const diff = ((((to - from) % 360) + 540) % 360) - 180;
  return from + diff * t;
}

/**
 * Server poses of one entity, timestamped with server time, sampled at a
 * slightly earlier render time so the entity moves smoothly between the
 * server's 30 updates per second instead of jumping on each one.
 */
export class PoseBuffer {
  private _snapshots: Snapshot[] = [];

  constructor(time: number, x: number, y: number, rotation: number) {
    this._snapshots.push({ time, x, y, rotation });
  }

  push(time: number, x: number, y: number, rotation: number): void {
    const last = this._snapshots[this._snapshots.length - 1];

    if (Math.hypot(x - last.x, y - last.y) > config.TELEPORT_DISTANCE) {
      // Respawn or similar: show the new place at once instead of sliding there
      this._snapshots = [{ time, x, y, rotation }];
      return;
    }

    if (time <= last.time) {
      // Same or older server time: the newest data wins
      last.x = x;
      last.y = y;
      last.rotation = rotation;
      return;
    }

    if (time - last.time > config.SERVER_TICK_MS * 1.5) {
      // The server only reports changes, so the entity stood still until the
      // tick before this one. Without this it would drift over the whole gap.
      this._snapshots.push({ ...last, time: time - config.SERVER_TICK_MS });
    }

    this._snapshots.push({ time, x, y, rotation });
    if (this._snapshots.length > MAX_SNAPSHOTS) {
      this._snapshots.splice(0, this._snapshots.length - MAX_SNAPSHOTS);
    }
  }

  /** Writes the pose at `time` (server ms) into `out` and returns it. */
  sample(time: number, out: IPose): IPose {
    const snapshots = this._snapshots;
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    let from: Snapshot = first;
    let to: Snapshot = first;
    if (time >= last.time) {
      from = to = last;
    } else if (time > first.time) {
      let i = snapshots.length - 2;
      while (i > 0 && snapshots[i].time > time) {
        i--;
      }
      from = snapshots[i];
      to = snapshots[i + 1];
      // Older snapshots are no longer needed
      if (i > 0) {
        snapshots.splice(0, i);
      }
    }

    const span = to.time - from.time;
    const t = span > 0 ? (time - from.time) / span : 0;
    out.x = from.x + (to.x - from.x) * t;
    out.y = from.y + (to.y - from.y) * t;
    out.rotation = lerpAngle(from.rotation, to.rotation, t);
    return out;
  }
}
