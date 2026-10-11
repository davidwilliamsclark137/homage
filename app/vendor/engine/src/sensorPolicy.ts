export type SensorVector = { x: number; y: number; z: number };
/** Normalize to gravity down, in g. iOS can subtract user acceleration. */
export function normalizeGravity(
  platform: 'android' | 'ios',
  value: SensorVector,
  acceleration?: SensorVector | null,
): SensorVector {
  if (platform === 'android') return { x: -value.x, y: -value.y, z: -value.z };
  return {
    x: (value.x - (acceleration?.x ?? 0)) / 9.80665,
    y: (value.y - (acceleration?.y ?? 0)) / 9.80665,
    z: (value.z - (acceleration?.z ?? 0)) / 9.80665,
  };
}
export function plausibleGravity(v: SensorVector) {
  const length = Math.hypot(v.x, v.y, v.z);
  return Number.isFinite(length) && length >= 0.8 && length <= 1.2;
}
/** Broad terrestrial field check, not proof of magnetic calibration. */
export function plausibleMagneticField(v: SensorVector) {
  const length = Math.hypot(v.x, v.y, v.z);
  return Number.isFinite(length) && length >= 15 && length <= 100;
}
/** Native timestamps are monotonic seconds, NOT epoch milliseconds. */
export function advancingSample(previous: number | null, next: number) {
  return Number.isFinite(next) && next >= 0 && (previous === null || next > previous);
}
