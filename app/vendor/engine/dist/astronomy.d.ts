import { CatalogStar, HorizontalPosition, Observer } from './types';
export declare function normalizeDegrees(value: number): number;
export declare function starToHorizontal(star: CatalogStar, observer: Observer, date: Date): HorizontalPosition;
export declare function basicStarToHorizontal(star: CatalogStar, observer: Observer, date: Date): HorizontalPosition;
export declare function skyQuality(observer: Observer, date: Date): {
    moonAltitude: number;
    moonPhaseFraction: number;
    sunAltitude: number;
    twilight: string;
};
export declare function angularDistance(first: HorizontalPosition, second: HorizontalPosition): number;
