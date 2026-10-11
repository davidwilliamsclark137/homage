export type SensorVector = {
    x: number;
    y: number;
    z: number;
};
/** Normalize to gravity down, in g. iOS can subtract user acceleration. */
export declare function normalizeGravity(platform: 'android' | 'ios', value: SensorVector, acceleration?: SensorVector | null): SensorVector;
export declare function plausibleGravity(v: SensorVector): boolean;
/** Broad terrestrial field check, not proof of magnetic calibration. */
export declare function plausibleMagneticField(v: SensorVector): boolean;
/** Native timestamps are monotonic seconds, NOT epoch milliseconds. */
export declare function advancingSample(previous: number | null, next: number): boolean;
