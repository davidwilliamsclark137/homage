import { CatalogStar, HorizontalStar, HorizontalPosition, Observer, ProjectedStar, SkyPose } from './types';
export declare function projectStars({ stars, observer, date, pose, width, height, horizontalFovDegrees, verticalFovDegrees, }: {
    stars: CatalogStar[];
    observer: Observer;
    date: Date;
    pose: SkyPose;
    width: number;
    height: number;
    horizontalFovDegrees?: number;
    verticalFovDegrees?: number;
}): ProjectedStar[];
export declare function calculateHorizontalStars(stars: CatalogStar[], observer: Observer, date: Date): HorizontalStar[];
export declare function projectHorizontalStars({ stars, pose, width, height, horizontalFovDegrees, verticalFovDegrees, visibleOnly, }: {
    stars: HorizontalStar[];
    pose: SkyPose;
    width: number;
    height: number;
    horizontalFovDegrees?: number;
    verticalFovDegrees?: number;
    visibleOnly?: boolean;
}): ProjectedStar[];
export declare function constellationCenter(stars: ProjectedStar[]): HorizontalPosition;
