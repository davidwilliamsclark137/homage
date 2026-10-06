import { skyQuality, starToHorizontal } from "./astronomy";
import { CONSTELLATIONS } from "./catalog";
import type { Observer } from "./types";
export function skyTargets(observer: Observer, date: Date, mode: 'pattern' | 'anchor' = 'pattern') {
  if (skyQuality(observer, date).sunAltitude > -6) return [];
  return CONSTELLATIONS.map(c => {
    const stars = c.stars.map(s => starToHorizontal(s, observer, date));
    const brightest = c.stars.reduce((a,b) => a.magnitude < b.magnitude ? a : b);
    const target = starToHorizontal(brightest, observer, date);
    return { constellation: c, anchor: brightest.name, target, available: (mode === 'anchor' ? target.altitude >= 12 : stars.every(s => s.altitude >= 12)) && target.altitude <= 80 };
  }).filter(c => c.available).sort((a,b) => b.target.altitude - a.target.altitude);
}
