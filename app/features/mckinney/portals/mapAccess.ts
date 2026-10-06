import portals from './mapPortals.json';
import { haversine } from '../../../lib/geo';
import { rooftopAccess, usableFix, type Fix } from './rooftop';

export const MAP_PORTALS = portals;
export type MapPortal = (typeof portals)[number];
export function portalAccess(portal: MapPortal, fix: Fix | null, platform: string, now = Date.now()) {
  if (portal.kind === 'rooftop') return rooftopAccess(fix, platform, now);
  if (!fix) return { ready: false, message: 'Finding your position…' };
  if (!usableFix(fix, now)) return { ready: false, message: 'Waiting for a fresh, more accurate location…' };
  const distance = haversine(fix, portal);
  return distance <= portal.radiusMeters
    ? { ready: true, message: 'You’re near the storefront. Portal available from the sidewalk.' }
    : { ready: false, message: 'Walk to the storefront · ' + Math.round(distance) + ' m away.' };
}

// Discovery is transient: no unlock history, and uncertain/stale fixes hide it.
export function isPortalVisible(portal: MapPortal, fix: Fix | null, now = Date.now()) {
  return !portal.hiddenUntilNearby ||
    (fix !== null && usableFix(fix, now) && haversine(fix, portal) <= portal.radiusMeters);
}
