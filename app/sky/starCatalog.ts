import catalog from "./hipparcos.naked-eye.json";

import { CatalogStar } from "./types";

type CatalogTuple = [
  hip: number,
  rightAscensionDegrees: number,
  declinationDegrees: number,
  magnitude: number,
  colorIndex: number | null,
];

const tuples = catalog.stars as CatalogTuple[];

export const HIPPARCOS_STARS: CatalogStar[] = tuples.map(
  ([hip, rightAscensionDegrees, declinationDegrees, magnitude, colorIndex]) => ({
    id: `hip-${hip}`,
    name: `HIP ${hip}`,
    rightAscensionHours: rightAscensionDegrees / 15,
    declinationDegrees,
    magnitude,
    colorIndex,
  }),
);

export const STAR_CATALOG_SOURCE = catalog.source;
