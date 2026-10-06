import { alignmentStatus as evaluate, skyTargets } from '../../../sky/engine';
export { skyTargets };
export const DOWNTOWN = { latitude: 33.1976, longitude: -96.6153 };
export function alignmentStatus(input: Parameters<typeof evaluate>[0]) {
 return evaluate(input,{center:DOWNTOWN,radiusMeters:1500});
}
export function alignmentGate(input: Parameters<typeof evaluate>[0]) { return alignmentStatus(input).aligned; }
