import garage from './chestnutGarage.json';
import { haversine } from '../../../lib/geo';

export { garage };
export type Fix = {
  latitude: number; longitude: number; accuracy: number | null;
  altitude: number | null; altitudeAccuracy: number | null; timestamp: number;
};
export type RooftopPlacement = {
  version: 1; sourceId: string; level: 'top-deck';
  latitude: number; longitude: number; modelHeightMeters: number;
  method: 'model-draft' | 'user-confirmed-on-site'; savedAt: number;
  fix: Fix | null; baseline: Fix | null;
};

export function insideGarage(fix: Pick<Fix, 'latitude' | 'longitude'>) {
  let inside = false;
  const ring = garage.footprint;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > fix.latitude) !== (yj > fix.latitude) &&
        fix.longitude < (xj - xi) * (fix.latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function usableFix(fix: Fix, now = Date.now()) {
  return Number.isFinite(fix.latitude) && Number.isFinite(fix.longitude) &&
    fix.accuracy !== null && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= 20 &&
    Number.isFinite(fix.timestamp) && now - fix.timestamp >= 0 && now - fix.timestamp <= 30000;
}

export function canPlace(fix: Fix, now = Date.now()) {
  return usableFix(fix, now) && insideGarage(fix);
}

export function canRecordBaseline(fix: Fix, now = Date.now()) {
  return usableFix(fix, now) && haversine(fix, garage.location) <= 100;
}

// Comparing phone readings from one short visit avoids mixing the model's
// surface-height reference with the phone's absolute altitude reference.
// This remains a diagnostic reading, never proof of a particular floor.
export function relativeHeight(fix: Fix | null, baseline: Fix | null) {
  if (!fix || !baseline || fix.timestamp < baseline.timestamp ||
      fix.timestamp - baseline.timestamp > 30 * 60 * 1000 ||
      fix.altitude === null || baseline.altitude === null ||
      !Number.isFinite(fix.altitude) || !Number.isFinite(baseline.altitude)) return null;
  return fix.altitude - baseline.altitude;
}

export function isPlacement(value: unknown): value is RooftopPlacement {
  if (!value || typeof value !== 'object') return false;
  const p = value as RooftopPlacement;
  return p.version === 1 && p.sourceId === garage.sourceId && p.level === 'top-deck' &&
    ['model-draft', 'user-confirmed-on-site'].includes(p.method) &&
    Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
    insideGarage(p) && p.modelHeightMeters === garage.modelHeightMeters && Number.isFinite(p.savedAt);
}

// A provisional model/phone comparison, not surveyed floor verification.
// Enabled only for iOS: Android altitude may use a different vertical datum.
export function rooftopAccess(fix: Fix | null, platform: string, now = Date.now()): { ready: boolean; message: string } {
  if (!fix) return { ready: false, message: 'Finding your position…' };
  if (!usableFix(fix, now)) return { ready: false, message: 'Waiting for a fresh, more accurate location…' };
  if (!insideGarage(fix)) return { ready: false, message: 'Travel to the Chestnut Commons top deck to try this portal.' };
  if (platform !== 'ios') return { ready: false, message: 'Automatic height testing currently supports iPhone. The preview works here.' };
  if (fix.altitude === null || !Number.isFinite(fix.altitude) ||
      fix.altitudeAccuracy === null || !Number.isFinite(fix.altitudeAccuracy) ||
      fix.altitudeAccuracy < 0 || fix.altitudeAccuracy > 5) {
    return { ready: false, message: 'Waiting for a clearer altitude reading. The portal stays locked while height is uncertain.' };
  }
  const difference = fix.altitude - garage.targetAltitudeMeters;
  if (Math.abs(difference) > 5) return { ready: false, message: difference < 0 ? 'Below the estimated rooftop portal. Head to the top deck.' : 'Above the model’s estimated height. The estimate may need adjustment.' };
  return { ready: true, message: 'Position matches the experimental rooftop target. Portal available.' };
}
