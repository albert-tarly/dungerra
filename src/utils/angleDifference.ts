/**
 * Smallest absolute difference between two angles in degrees, in [0, 180].
 * Handles wrap-around, e.g. 359° and 1° are 2° apart.
 */
export function angleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
