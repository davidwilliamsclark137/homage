export type SkyHold = {
    target: string | null;
    elapsed: number;
    last: number;
    outsideSince: number | null;
    tracking: boolean;
};
export declare const emptyHold: () => SkyHold;
export declare function advanceSkyHold(previous: SkyHold, now: number, target: string | null, ready: boolean, offset: number): SkyHold;
