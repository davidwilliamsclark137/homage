"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCKINNEY_TIME_ZONE = exports.MCKINNEY = exports.SKY_MODEL_VERSION = void 0;
exports.bodyPosition = bodyPosition;
exports.mckinneySky = mckinneySky;
exports.mckinneyDate = mckinneyDate;
exports.mckinneyDayBounds = mckinneyDayBounds;
exports.dailySky = dailySky;
exports.upcomingSkyEvents = upcomingSkyEvents;
const A = __importStar(require("astronomy-engine"));
const starCatalog_1 = require("./starCatalog");
const catalog_1 = require("./catalog");
const astronomy_1 = require("./astronomy");
exports.SKY_MODEL_VERSION = '0.2.0';
/** Fixed reference near the downtown square; not a GPS measurement. */
exports.MCKINNEY = {
    latitude: 33.1976,
    longitude: -96.6153,
    elevationMeters: 0,
};
exports.MCKINNEY_TIME_ZONE = 'America/Chicago';
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
];
const PHASES = ['New moon', 'First quarter', 'Full moon', 'Last quarter'];
const named = catalog_1.CONSTELLATIONS.flatMap((c) => c.stars);
const known = {
    'hip-32349': 'Sirius',
    'hip-91262': 'Vega',
    'hip-97649': 'Altair',
    'hip-69673': 'Arcturus',
    'hip-11767': 'Polaris',
};
let catalog;
function getCatalog() {
    return (catalog ?? (catalog = starCatalog_1.HIPPARCOS_STARS.map((star) => {
        const group = A.Constellation(star.rightAscensionHours, star.declinationDegrees);
        const name = named.find((n) => (0, astronomy_1.angularDistance)({ azimuth: n.rightAscensionHours * 15, altitude: n.declinationDegrees }, { azimuth: star.rightAscensionHours * 15, altitude: star.declinationDegrees }) < 0.03)?.name;
        return {
            ...star,
            name: known[star.id] ?? name ?? star.name,
            constellation: group.symbol,
            constellationName: group.name,
        };
    })));
}
function validate(date, observer) {
    if (!Number.isFinite(date.getTime()) ||
        date.getUTCFullYear() < 1900 ||
        date.getUTCFullYear() > 2100)
        throw new RangeError('Use a date from 1900 through 2100.');
    if (![observer.latitude, observer.longitude, observer.elevationMeters ?? 0].every(Number.isFinite) ||
        Math.abs(observer.latitude) > 90 ||
        Math.abs(observer.longitude) > 180)
        throw new RangeError('Invalid observer.');
}
const observerOf = (o) => new A.Observer(o.latitude, o.longitude, o.elevationMeters ?? 0);
function bodyPosition(body, date, observer = exports.MCKINNEY) {
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
function mckinneySky(date = new Date(), observer = exports.MCKINNEY) {
    validate(date, observer);
    const stars = getCatalog()
        .map((s) => ({ ...s, ...(0, astronomy_1.starToHorizontal)(s, observer, date) }))
        .filter((s) => s.altitude > 0);
    const bodies = BODIES.map((b) => bodyPosition(b, date, observer));
    const sun = bodies[0];
    const groups = new Map();
    const totals = new Map();
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
        }
        else
            groups.set(s.constellation, {
                id: s.constellation,
                name: s.constellationName,
                aboveHorizonStars: 1,
                catalogStars: totals.get(s.constellation),
                brightestMagnitude: s.magnitude,
                altitude: s.altitude,
                azimuth: s.azimuth,
            });
    }
    return {
        version: exports.SKY_MODEL_VERSION,
        utc: date.toISOString(),
        observer,
        timeZone: exports.MCKINNEY_TIME_ZONE,
        catalogSource: starCatalog_1.STAR_CATALOG_SOURCE,
        catalogSize: starCatalog_1.HIPPARCOS_STARS.length,
        stars,
        bodies,
        constellations: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)),
        sunAltitude: sun.altitude,
        skyState: sun.altitude >= 0
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
    timeZone: exports.MCKINNEY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});
function mckinneyDate(date = new Date()) {
    const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
}
function localMidnight(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        throw new RangeError('Expected YYYY-MM-DD.');
    const desired = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(desired) || new Date(desired).toISOString().slice(0, 10) !== day)
        throw new RangeError('Invalid date.');
    let guess = desired;
    for (let i = 0; i < 4; i++) {
        const p = Object.fromEntries(partsFormatter.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
        const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
        guess += desired - represented;
    }
    return new Date(guess);
}
function mckinneyDayBounds(day) {
    const start = localMidnight(day);
    const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000)
        .toISOString()
        .slice(0, 10);
    return { start, end: localMidnight(next) };
}
function dailySky(day = mckinneyDate(), observer = exports.MCKINNEY) {
    const { start, end } = mckinneyDayBounds(day);
    validate(start, observer);
    const o = observerOf(observer), span = (end.getTime() - start.getTime()) / 86400000;
    const events = [];
    const add = (time, kind, title, detail) => {
        if (time && time.date >= start && time.date < end)
            events.push({ kind, title, utc: time.date.toISOString(), detail });
    };
    for (const body of BODIES)
        for (const direction of [1, -1]) {
            // A civil day can be 25 hours; enumerate to avoid losing a second crossing.
            let cursor = start;
            for (let n = 0; n < 3; n++) {
                const t = A.SearchRiseSet(body, o, direction, cursor, (end.getTime() - cursor.getTime()) / 86400000);
                if (!t || t.date >= end)
                    break;
                add(t, 'rise-set', `${body}${direction === 1 ? ' rises' : ' sets'}`, 'Ideal unobstructed horizon; standard refraction.');
                cursor = new Date(t.date.getTime() + 1000);
            }
        }
    for (const [alt, label] of [
        [-6, 'Civil'],
        [-12, 'Nautical'],
        [-18, 'Astronomical'],
    ])
        for (const direction of [1, -1])
            add(A.SearchAltitude(A.Body.Sun, o, direction, start, span, alt), 'twilight', `${label} ${direction === 1 ? 'dawn' : 'dusk'}`, `Sun center ${alt}° below the horizon.`);
    let phase = A.SearchMoonQuarter(start);
    while (phase.time.date < end) {
        add(phase.time, 'moon-phase', PHASES[phase.quarter], 'Global phase instant; Moon may be below McKinney’s horizon.');
        phase = A.NextMoonQuarter(phase);
    }
    events.push(...upcomingSkyEvents(start, observer).filter((e) => e.kind !== 'moon-phase' && Date.parse(e.utc) < end.getTime()));
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
        timeZone: exports.MCKINNEY_TIME_ZONE,
        start: start.toISOString(),
        end: end.toISOString(),
        hours: span * 24,
        events: events.sort((a, b) => a.utc.localeCompare(b.utc)),
        samples,
    };
}
/** Future phase instants and eclipses with peak above the local horizon. */
function upcomingSkyEvents(date = new Date(), observer = exports.MCKINNEY) {
    validate(date, observer);
    const events = [];
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
        ]) {
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
