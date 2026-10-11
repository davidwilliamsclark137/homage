import type { Observer } from './types';
export declare function skyTargets(observer: Observer, date: Date, mode?: 'pattern' | 'anchor'): {
    constellation: import("./types").Constellation;
    anchor: string;
    target: import("./types").HorizontalPosition;
    available: boolean;
}[];
