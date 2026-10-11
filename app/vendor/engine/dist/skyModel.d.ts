import * as A from 'astronomy-engine';
import type { Observer } from './types';
export declare const SKY_MODEL_VERSION = "0.2.0";
/** Fixed reference near the downtown square; not a GPS measurement. */
export declare const MCKINNEY: Observer;
export declare const MCKINNEY_TIME_ZONE = "America/Chicago";
declare const BODIES: readonly [A.Body.Sun, A.Body.Moon, A.Body.Mercury, A.Body.Venus, A.Body.Mars, A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus, A.Body.Neptune];
export declare function bodyPosition(body: (typeof BODIES)[number], date: Date, observer?: Observer): {
    id: A.Body.Sun | A.Body.Moon | A.Body.Mercury | A.Body.Venus | A.Body.Mars | A.Body.Jupiter | A.Body.Saturn | A.Body.Uranus | A.Body.Neptune;
    name: A.Body.Sun | A.Body.Moon | A.Body.Mercury | A.Body.Venus | A.Body.Mars | A.Body.Jupiter | A.Body.Saturn | A.Body.Uranus | A.Body.Neptune;
    kind: string;
    altitude: number;
    azimuth: number;
    aboveHorizon: boolean;
    magnitude: number;
    illuminatedFraction: number;
};
/** Complete catalog above the apparent, unobstructed horizontal horizon. */
export declare function mckinneySky(date?: Date, observer?: Observer): {
    version: string;
    utc: string;
    observer: Observer;
    timeZone: string;
    catalogSource: string;
    catalogSize: number;
    stars: {
        altitude: number;
        azimuth: number;
        id: string;
        name: string;
        rightAscensionHours: number;
        declinationDegrees: number;
        magnitude: number;
        colorIndex?: number | null;
        constellation: string;
        constellationName: string;
    }[];
    bodies: {
        id: A.Body.Sun | A.Body.Moon | A.Body.Mercury | A.Body.Venus | A.Body.Mars | A.Body.Jupiter | A.Body.Saturn | A.Body.Uranus | A.Body.Neptune;
        name: A.Body.Sun | A.Body.Moon | A.Body.Mercury | A.Body.Venus | A.Body.Mars | A.Body.Jupiter | A.Body.Saturn | A.Body.Uranus | A.Body.Neptune;
        kind: string;
        altitude: number;
        azimuth: number;
        aboveHorizon: boolean;
        magnitude: number;
        illuminatedFraction: number;
    }[];
    constellations: {
        id: string;
        name: string;
        aboveHorizonStars: number;
        catalogStars: number;
        brightestMagnitude: number;
        altitude: number;
        azimuth: number;
    }[];
    sunAltitude: number;
    skyState: string;
    moonPhaseDegrees: number;
    moonIlluminatedFraction: number;
};
export declare function mckinneyDate(date?: Date): string;
export declare function mckinneyDayBounds(day: string): {
    start: Date;
    end: Date;
};
export type SkyEvent = {
    kind: string;
    title: string;
    utc: string;
    detail: string;
};
export declare function dailySky(day?: string, observer?: Observer): {
    day: string;
    timeZone: string;
    start: string;
    end: string;
    hours: number;
    events: SkyEvent[];
    samples: {
        utc: string;
        sunAltitude: number;
        moonAltitude: number;
    }[];
};
/** Future phase instants and eclipses with peak above the local horizon. */
export declare function upcomingSkyEvents(date?: Date, observer?: Observer): SkyEvent[];
export {};
