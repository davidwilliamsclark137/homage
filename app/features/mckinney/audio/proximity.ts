import { haversine } from "../../../lib/geo";
import { MAP_PORTALS, portalAccess } from "../portals/mapAccess";
import { usableFix, type Fix } from "../portals/rooftop";

export const LISTENING_RADIUS = 60;

// Keep the current signal until another is five metres nearer, avoiding GPS chatter.
export function proximitySignal(
  fix: Fix | null,
  platform: string,
  now: number,
  previousId: string | null = null,
) {
  if (!fix || !usableFix(fix, now)) return null;
  const nearby = MAP_PORTALS.map((portal) => ({
    portal,
    distance: haversine(fix, portal),
  }))
    .filter((item) => item.distance < LISTENING_RADIUS)
    .sort((a, b) => a.distance - b.distance);
  if (!nearby.length) return null;
  const previous = nearby.find((item) => item.portal.id === previousId);
  const target =
    previous && previous.distance <= nearby[0].distance + 5
      ? previous
      : nearby[0];
  const ready = portalAccess(target.portal, fix, platform, now).ready;
  const approach = Math.max(
    0,
    Math.min(1, (LISTENING_RADIUS - target.distance) / (LISTENING_RADIUS - 18)),
  );
  return {
    id: target.portal.id,
    // A rooftop must pass its altitude gate before the chord can fully resolve.
    tuning: ready ? 1 : Math.min(0.9, approach),
    volume: 0.3 * Math.min(1, (LISTENING_RADIUS - target.distance) / 12),
    ready,
  };
}
