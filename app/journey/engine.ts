import places from './places.json';

export const JOURNEY_ID = 'downtown-three-v1';
export const STORAGE_KEY = 'homage:journey:' + JOURNEY_ID;
export const PORTALS = places.map((place, index) => ({
  ...place,
  index,
  title: ['A beginning', 'A little wonder', 'Carry it with you'][index],
  hidden: index === 1,
  clue: [
    'Start outside the north side of the Performing Arts Center, on the square.',
    'Follow the public sidewalk toward the east side of the square. Look for Goodies Texas on North Tennessee Street. The portal appears when you are close.',
    'Continue around the square to the Landon Winery storefront at 101 N Kentucky Street. Stay outside on the public sidewalk.',
  ][index],
}));
export type Fix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};
export type Progress = {
  journeyId: string;
  completed: string[];
  completedAt: string | null;
};
export const emptyProgress = (): Progress => ({
  journeyId: JOURNEY_ID,
  completed: [],
  completedAt: null,
});
export function restoreProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  const p = JSON.parse(raw);
  if (
    p.journeyId !== JOURNEY_ID ||
    !Array.isArray(p.completed) ||
    p.completed.length > PORTALS.length ||
    p.completed.some((id: unknown, i: number) => id !== PORTALS[i].id) ||
    (p.completedAt !== null &&
      (typeof p.completedAt !== 'string' ||
        !Number.isFinite(Date.parse(p.completedAt)))) ||
    (p.completed.length === PORTALS.length) !== (p.completedAt !== null)
  )
    throw Error('Saved journey could not be read.');
  return p;
}
export function distance(
  a: Pick<Fix, 'latitude' | 'longitude'>,
  b: Pick<Fix, 'latitude' | 'longitude'>,
) {
  const rad = Math.PI / 180;
  const dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function locationIssue(fix: Fix | null, now: number): string | null {
  if (!fix)
    return 'Waiting for your location. Step outside with a clear view of the sky.';
  if (
    ![fix.latitude, fix.longitude, fix.accuracy, fix.timestamp].every(
      Number.isFinite,
    ) ||
    Math.abs(fix.latitude) > 90 ||
    Math.abs(fix.longitude) > 180 ||
    fix.accuracy < 0
  )
    return 'Waiting for a valid location reading.';
  if (now - fix.timestamp > 15000 || now < fix.timestamp)
    return 'Location is out of date. Waiting for a fresh reading.';
  if (fix.accuracy > 20) return 'GPS needs to settle. Accuracy must be within 20 m.';
  return null;
}
export function nearby(fix: Fix | null, index: number, now: number) {
  return (
    !!PORTALS[index] && !locationIssue(fix, now) && distance(fix!, PORTALS[index]) <= 25
  );
}
export type Arrival = { since: number; firstTimestamp: number; ready: boolean } | null;
export function updateArrival(
  previous: Arrival,
  fix: Fix | null,
  index: number,
  now: number,
): Arrival {
  if (!nearby(fix, index, now)) return null;
  if (!previous) return { since: now, firstTimestamp: fix!.timestamp, ready: false };
  return {
    ...previous,
    ready: now - previous.since >= 3000 && fix!.timestamp > previous.firstTimestamp,
  };
}
export function activate(
  progress: Progress,
  portalId: string,
  fix: Fix | null,
  arrival: Arrival,
  now: number,
): Progress {
  const index = progress.completed.length;
  if (PORTALS[index]?.id !== portalId || !nearby(fix, index, now) || !arrival?.ready)
    return progress;
  const completed = [...progress.completed, portalId];
  return {
    journeyId: JOURNEY_ID,
    completed,
    completedAt:
      completed.length === PORTALS.length ? new Date(now).toISOString() : null,
  };
}
