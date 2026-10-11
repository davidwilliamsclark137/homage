import * as A from 'astronomy-engine';
import { HIPPARCOS_STARS, STAR_CATALOG_SOURCE } from './starCatalog';
import { CONSTELLATIONS } from './catalog';
import { angularDistance, starToHorizontal } from './astronomy';
import type { Observer, CatalogStar } from './types';

export const SKY_MODEL_VERSION = '0.2.0';
/** Fixed reference near the downtown square; not a GPS measurement. */
export const MCKINNEY: Observer = {
  latitude: 33.1976,
  longitude: -96.6153,
  elevationMeters: 0,
};
export const MCKINNEY_TIME_ZONE = 'America/Chicago';
const BODIES = [
  A.Body.Sun,
  A.Body.Moon,
  A.Body.Mercury,
  A.Body.Venus,
  A.Body.Mars,
  A.Body.Jupiter,
  A.Body.Saturn,
  A.Body.Uranus,
  A.Body.Neptune,
] as const;
const PHASES = ['New moon', 'First quarter', 'Full moon', 'Last quarter'];
const named = CONSTELLATIONS.flatMap((c) => c.stars);
const known: Record<string, string> = {
  'hip-32349': 'Sirius',
  'hip-91262': 'Vega',
  'hip-97649': 'Altair',
  'hip-69673': 'Arcturus',
  'hip-11767': 'Polaris',
};
let catalog:
  | Array<CatalogStar & { constellation: string; constellationName: string }>
  | undefined;
function getCatalog() {
  return (catalog ??= HIPPARCOS_STARS.map((star) => {
    const group = A.Constellation(star.rightAscensionHours, star.declinationDegrees);
    const name = named.find(
      (n) =>
        angularDistance(
          { azimuth: n.rightAscensionHours * 15, altitude: n.declinationDegrees },
          { azimuth: star.rightAscensionHours * 15, altitude: star.declinationDegrees },
        ) < 0.03,
    )?.name;
    return {
      ...star,
      name: known[star.id] ?? name ?? star.name,
      constellation: group.symbol,
      constellationName: group.name,
    };
  }));
}
function validate(date: Date, observer: Observer) {
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1900 ||
    date.getUTCFullYear() > 2100
  )
    throw new RangeError('Use a date from 1900 through 2100.');
  if (
    ![observer.latitude, observer.longitude, observer.elevationMeters ?? 0].every(
      Number.isFinite,
    ) ||
    Math.abs(observer.latitude) > 90 ||
    Math.abs(observer.longitude) > 180
  )
    throw new RangeError('Invalid observer.');
}
const observerOf = (o: Observer) =>
  new A.Observer(o.latitude, o.longitude, o.elevationMeters ?? 0);
export function bodyPosition(
  body: (typeof BODIES)[number],
  date: Date,
  observer: Observer = MCKINNEY,
) {
  const o = observerOf(observer);
  const eq = A.Equator(body, date, o, true, true);
  const h = A.Horizon(date, o, eq.ra, eq.dec, 'normal');
  const light = A.Illumination(body, date);
  return {
    id: body,
    name: body,
    kind: body === A.Body.Sun ? 'sun' : body === A.Body.Moon ? 'moon' : 'planet',
    altitude: h.altitude,
    azimuth: h.azimuth,
    aboveHorizon: h.altitude > 0,
    magnitude: light.mag,
    illuminatedFraction: light.phase_fraction,
  };
}
/** Complete catalog above the apparent, unobstructed horizontal horizon. */
export function mckinneySky(date: Date = new Date(), observer: Observer = MCKINNEY) {
  validate(date, observer);
  const stars = getCatalog()
    .map((s) => ({ ...s, ...starToHorizontal(s, observer, date) }))
    .filter((s) => s.altitude > 0);
  const bodies = BODIES.map((b) => bodyPosition(b, date, observer));
  const sun = bodies[0];
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      aboveHorizonStars: number;
      catalogStars: number;
      brightestMagnitude: number;
      altitude: number;
      azimuth: number;
    }
  >();
  const totals = new Map<string, number>();
  for (const s of getCatalog())
    totals.set(s.constellation, (totals.get(s.constellation) ?? 0) + 1);
  for (const s of stars) {
    const existing = groups.get(s.constellation);
    if (existing) {
      existing.aboveHorizonStars++;
      if (s.magnitude < existing.brightestMagnitude)
        Object.assign(existing, {
          brightestMagnitude: s.magnitude,
          altitude: s.altitude,
          azimuth: s.azimuth,
        });
    } else
      groups.set(s.constellation, {
        id: s.constellation,
        name: s.constellationName,
        aboveHorizonStars: 1,
        catalogStars: totals.get(s.constellation)!,
        brightestMagnitude: s.magnitude,
        altitude: s.altitude,
        azimuth: s.azimuth,
      });
  }
  return {
    version: SKY_MODEL_VERSION,
    utc: date.toISOString(),
    observer,
    timeZone: MCKINNEY_TIME_ZONE,
    catalogSource: STAR_CATALOG_SOURCE,
    catalogSize: HIPPARCOS_STARS.length,
    stars,
    bodies,
    constellations: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
    sunAltitude: sun.altitude,
    skyState:
      sun.altitude >= 0
        ? 'Daylight'
        : sun.altitude >= -6
          ? 'Civil twilight'
          : sun.altitude >= -12
            ? 'Nautical twilight'
            : sun.altitude >= -18
              ? 'Astronomical twilight'
              : 'Dark sky',
    moonPhaseDegrees: A.MoonPhase(date),
    moonIlluminatedFraction: bodies[1].illuminatedFraction,
  };
}
const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MCKINNEY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
export function mckinneyDate(date: Date = new Date()) {
  const p = Object.fromEntries(
    partsFormatter.formatToParts(date).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
function localMidnight(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError('Expected YYYY-MM-DD.');
  const desired = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(desired) || new Date(desired).toISOString().slice(0, 10) !== day)
    throw new RangeError('Invalid date.');
  let guess = desired;
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(
      partsFormatter.formatToParts(new Date(guess)).map((x) => [x.type, x.value]),
    );
    const represented = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    guess += desired - represented;
  }
  return new Date(guess);
}
export function mckinneyDayBounds(day: string) {
  const start = localMidnight(day);
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
  return { start, end: localMidnight(next) };
}
export type SkyEvent = { kind: string; title: string; utc: string; detail: string };
export function dailySky(day: string = mckinneyDate(), observer: Observer = MCKINNEY) {
  const { start, end } = mckinneyDayBounds(day);
  validate(start, observer);
  const o = observerOf(observer),
    span = (end.getTime() - start.getTime()) / 86400000;
  const events: SkyEvent[] = [];
  const add = (
    time: A.AstroTime | null,
    kind: string,
    title: string,
    detail: string,
  ) => {
    if (time && time.date >= start && time.date < end)
      events.push({ kind, title, utc: time.date.toISOString(), detail });
  };
  for (const body of BODIES)
    for (const direction of [1, -1]) {
      // A civil day can be 25 hours; enumerate to avoid losing a second crossing.
      let cursor = start;
      for (let n = 0; n < 3; n++) {
        const t = A.SearchRiseSet(
          body,
          o,
          direction,
          cursor,
          (end.getTime() - cursor.getTime()) / 86400000,
        );
        if (!t || t.date >= end) break;
        add(
          t,
          'rise-set',
          `${body}${direction === 1 ? ' rises' : ' sets'}`,
          'Ideal unobstructed horizon; standard refraction.',
        );
        cursor = new Date(t.date.getTime() + 1000);
      }
    }
  for (const [alt, label] of [
    [-6, 'Civil'],
    [-12, 'Nautical'],
    [-18, 'Astronomical'],
  ] as const)
    for (const direction of [1, -1])
      add(
        A.SearchAltitude(A.Body.Sun, o, direction, start, span, alt),
        'twilight',
        `${label} ${direction === 1 ? 'dawn' : 'dusk'}`,
        `Sun center ${alt}° below the horizon.`,
      );
  let phase = A.SearchMoonQuarter(start);
  while (phase.time.date < end) {
    add(
      phase.time,
      'moon-phase',
      PHASES[phase.quarter],
      'Global phase instant; Moon may be below McKinney’s horizon.',
    );
    phase = A.NextMoonQuarter(phase);
  }
  events.push(
    ...upcomingSkyEvents(start, observer).filter(
      (e) => e.kind !== 'moon-phase' && Date.parse(e.utc) < end.getTime(),
    ),
  );
  const samples = [];
  for (let t = start.getTime(); t < end.getTime(); t += 3600000) {
    const date = new Date(t);
    samples.push({
      utc: date.toISOString(),
      sunAltitude: bodyPosition(A.Body.Sun, date, observer).altitude,
      moonAltitude: bodyPosition(A.Body.Moon, date, observer).altitude,
    });
  }
  return {
    day,
    timeZone: MCKINNEY_TIME_ZONE,
    start: start.toISOString(),
    end: end.toISOString(),
    hours: span * 24,
    events: events.sort((a, b) => a.utc.localeCompare(b.utc)),
    samples,
  };
}
/** Future phase instants and eclipses with peak above the local horizon. */
export function upcomingSkyEvents(
  date: Date = new Date(),
  observer: Observer = MCKINNEY,
) {
  validate(date, observer);
  const events: SkyEvent[] = [];
  let phase = A.SearchMoonQuarter(date);
  for (let i = 0; i < 4; i++) {
    events.push({
      kind: 'moon-phase',
      title: PHASES[phase.quarter],
      utc: phase.time.date.toISOString(),
      detail: 'Global phase instant; not a guarantee the Moon is above the horizon.',
    });
    phase = A.NextMoonQuarter(phase);
  }
  const end = new Date(date.getTime() + 366 * 86400000);
  let lunar = A.SearchLunarEclipse(date);
  while (lunar.peak.date < end) {
    const moon = bodyPosition(A.Body.Moon, lunar.peak.date, observer);
    if (moon.aboveHorizon)
      events.push({
        kind: 'lunar-eclipse',
        title: `${lunar.kind} lunar eclipse`,
        utc: lunar.peak.date.toISOString(),
        detail: `Peak with Moon ${moon.altitude.toFixed(1)}° above the ideal horizon.`,
      });
    lunar = A.NextLunarEclipse(lunar.peak);
  }
  let solar = A.SearchLocalSolarEclipse(date, observerOf(observer));
  while (solar.peak.time.date < end) {
    if (solar.peak.altitude > 0)
      events.push({
        kind: 'solar-eclipse',
        title: `${solar.kind} solar eclipse`,
        utc: solar.peak.time.date.toISOString(),
        detail: `Local peak: ${(solar.obscuration * 100).toFixed(1)}% obscuration. Safe solar viewing equipment required.`,
      });
    solar = A.NextLocalSolarEclipse(solar.peak.time, observerOf(observer));
  }
  for (let year = date.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    const seasons = A.Seasons(year);
    for (const [time, title] of [
      [seasons.mar_equinox, 'March equinox'],
      [seasons.jun_solstice, 'June solstice'],
      [seasons.sep_equinox, 'September equinox'],
      [seasons.dec_solstice, 'December solstice'],
    ] as const) {
      if (time.date >= date && time.date < end)
        events.push({
          kind: 'season',
          title,
          utc: time.date.toISOString(),
          detail: 'Global seasonal turning point, shown in McKinney local time.',
        });
    }
  }
  return events.sort((a, b) => a.utc.localeCompare(b.utc));
}
