// app/lib/geo.ts
export type LatLng = { latitude: number; longitude: number };

const R = 6371000; // meters

export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s)); // meters
}

export function offset(from: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lon1 = (from.longitude * Math.PI) / 180;
  const dr = distanceM / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

// tiny deterministic PRNG from a seed
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// derive a repeatable seed from lat/lon rounded to ~20 m
export function seedFromLatLng(lat: number, lon: number): number {
  const L = Math.round(lat * 5000);  // ~20 m grid
  const O = Math.round(lon * 5000);
  return (L * 73856093) ^ (O * 19349663);
}

