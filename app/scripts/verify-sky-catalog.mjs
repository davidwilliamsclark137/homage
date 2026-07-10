import { readFile } from "node:fs/promises";

const catalog = JSON.parse(
  await readFile(new URL("../sky/hipparcos.naked-eye.json", import.meta.url)),
);
const stars = catalog.stars;
const ids = new Set();

if (stars.length < 8_000 || stars.length > 10_000) {
  throw new Error(`Unexpected naked-eye star count: ${stars.length}.`);
}

for (const [hip, ra, dec, magnitude, colorIndex] of stars) {
  if (ids.has(hip)) throw new Error(`Duplicate HIP identifier: ${hip}`);
  ids.add(hip);
  if (!Number.isInteger(hip) || hip <= 0) throw new Error(`Invalid HIP: ${hip}`);
  if (ra < 0 || ra >= 360) throw new Error(`Invalid RA for HIP ${hip}: ${ra}`);
  if (dec < -90 || dec > 90) {
    throw new Error(`Invalid declination for HIP ${hip}: ${dec}`);
  }
  if (!Number.isFinite(magnitude) || magnitude > 6.5) {
    throw new Error(`Invalid magnitude for HIP ${hip}: ${magnitude}`);
  }
  if (colorIndex !== null && !Number.isFinite(colorIndex)) {
    throw new Error(`Invalid B-V color for HIP ${hip}: ${colorIndex}`);
  }
}

for (const knownHip of [11767, 32349, 71683]) {
  if (!ids.has(knownHip)) {
    throw new Error(`Expected reference star HIP ${knownHip} is missing.`);
  }
}

console.log(
  `Verified ${stars.length} unique Hipparcos stars, including Polaris, Sirius, and Alpha Centauri.`,
);
