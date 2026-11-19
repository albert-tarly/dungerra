// How fast the offset follows samples that arrive later than the best one
// seen so far (per message). Small, so a burst of delayed messages does not
// shift the timeline, but clock drift is still tracked over minutes.
const OFFSET_DRIFT_RATE = 0.002;

function localNow(): number {
  // Monotonic, unlike Date.now(), but on the same epoch scale
  return performance.timeOrigin + performance.now();
}

/**
 * Maps server timestamps (epoch milliseconds from the server's clock, e.g.
 * GameStateDeltaMessage.timestamp and Bullet.deletedAt) onto the local clock,
 * so the player's computer clock does not need to agree with the server's.
 *
 * The offset is the smallest "local receive time − server timestamp" seen,
 * i.e. the message that was delayed least by the network.
 */
class ServerClock {
  private _offset: number | null = null;

  observe(serverTimestamp: number): void {
    const sample = localNow() - serverTimestamp;
    if (this._offset === null || sample < this._offset) {
      this._offset = sample;
    } else {
      this._offset += (sample - this._offset) * OFFSET_DRIFT_RATE;
    }
  }

  /** Current server time estimate, in server epoch milliseconds. */
  now(): number {
    return localNow() - (this._offset ?? 0);
  }
}

export const serverClock = new ServerClock();
