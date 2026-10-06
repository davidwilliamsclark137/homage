import { angularDistance } from "./astronomy";
import type { Observer } from "./types";
function distanceMeters(a: Observer,b: Observer) {
 const rad=Math.PI/180, dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function alignmentStatus(input: {
  observer: Observer | null; accuracy: number | null; locationTimestamp: number | null;
  headingAccuracy: number; headingTimestamp: number | null; motionTimestamp: number | null;
  heading: number; altitude: number; now: number;
  target: { altitude: number; azimuth: number } | null;
}, region?: { center: Observer; radiusMeters: number }) {
  const fresh = (t: number | null, max: number) => t !== null && input.now - t >= 0 && input.now - t <= max;
  if (!input.observer) return { aligned: false, message: 'Waiting for your GPS location.' };
  if (region && distanceMeters(input.observer,region.center) > region.radiusMeters) return { aligned: false, message: 'Move inside the configured scan area.' };
  if (input.accuracy === null || input.accuracy < 0 || input.accuracy > 20 || !fresh(input.locationTimestamp,30000)) return { aligned: false, message: `Waiting for fresh GPS accuracy of 20 m or better (now ${input.accuracy === null ? 'unknown' : Math.round(input.accuracy) + ' m'}).` };
  if (input.headingAccuracy < 3 || !fresh(input.headingTimestamp,15000)) return { aligned: false, message: `Compass not ready (${input.headingAccuracy}/3). Move away from cars, metal, and the other phone; gently move this phone in a figure eight.` };
  if (!fresh(input.motionTimestamp,1000)) return { aligned: false, message: 'Waiting for motion readings. Check Sensors permission, then restart sky sensors.' };
  if (!input.target) return { aligned: false, message: 'Choose an available constellation.' };
  const offset = angularDistance(input.target,{ azimuth: input.heading, altitude: input.altitude });
  if (!Number.isFinite(offset)) return { aligned: false, message: 'Waiting for a valid sky direction.' };
  return { ready: true, offset, aligned: offset <= 7, message: `Anchor is ${offset.toFixed(1)}° from center. Bring it within 7° and hold steady.` };
}
export function alignmentGate(input: Parameters<typeof alignmentStatus>[0]) {
  return alignmentStatus(input).aligned;
}
