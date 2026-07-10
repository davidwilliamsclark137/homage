import { normalizeDegrees, starToHorizontal } from "./astronomy";
import { Observer } from "./types";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function sunToHorizontal(observer: Observer, date: Date) {
  const julianDate = date.getTime() / 86_400_000 + 2_440_587.5;
  const days = julianDate - 2_451_545;
  const meanLongitude = normalizeDegrees(280.46 + 0.9856474 * days);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * days);
  const anomalyRadians = meanAnomaly * DEG_TO_RAD;
  const eclipticLongitude =
    normalizeDegrees(
      meanLongitude +
        1.915 * Math.sin(anomalyRadians) +
        0.02 * Math.sin(2 * anomalyRadians),
    ) * DEG_TO_RAD;
  const obliquity = (23.439 - 0.0000004 * days) * DEG_TO_RAD;
  const rightAscension = normalizeDegrees(
    Math.atan2(
      Math.cos(obliquity) * Math.sin(eclipticLongitude),
      Math.cos(eclipticLongitude),
    ) * RAD_TO_DEG,
  );
  const declination =
    Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) * RAD_TO_DEG;

  return starToHorizontal(
    {
      id: "sun",
      name: "Sun",
      rightAscensionHours: rightAscension / 15,
      declinationDegrees: declination,
      magnitude: -26.74,
    },
    observer,
    date,
  );
}
