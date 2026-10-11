export type Observer = {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
};

export type CatalogStar = {
  id: string;
  name: string;
  rightAscensionHours: number;
  declinationDegrees: number;
  magnitude: number;
  colorIndex?: number | null;
};

export type Constellation = {
  id: string;
  name: string;
  shortName: string;
  stars: CatalogStar[];
  segments: Array<[string, string]>;
};

export type HorizontalPosition = {
  altitude: number;
  azimuth: number;
};

export type HorizontalStar = CatalogStar & HorizontalPosition;

export type ProjectedStar = HorizontalStar & {
  x: number;
  y: number;
  inFront: boolean;
  onScreen: boolean;
};

export type SkyPose = {
  altitude: number;
  heading: number;
  roll: number;
};
