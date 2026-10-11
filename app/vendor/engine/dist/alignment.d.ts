import type { Observer } from './types';
export declare function alignmentStatus(input: {
    observer: Observer | null;
    accuracy: number | null;
    locationTimestamp: number | null;
    qualityTimestamp: number | null;
    headingAccuracy: number;
    headingTimestamp: number | null;
    motionTimestamp: number | null;
    heading: number;
    altitude: number;
    now: number;
    target: {
        altitude: number;
        azimuth: number;
    } | null;
}, region?: {
    center: Observer;
    radiusMeters: number;
}): {
    aligned: boolean;
    message: string;
    ready?: undefined;
    offset?: undefined;
} | {
    ready: boolean;
    offset: number;
    aligned: boolean;
    message: string;
};
export declare function alignmentGate(input: Parameters<typeof alignmentStatus>[0]): boolean;
