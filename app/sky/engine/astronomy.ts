import * as Astronomy from "astronomy-engine";

import { CatalogStar, HorizontalPosition, Observer } from "./types";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function julianDate(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

function localSiderealDegrees(date: Date, longitude: number) {
  const jd = julianDate(date);
  const centuries = (jd - 2_451_545) / 36_525;
  const greenwich =
    280.46061837 +
    360.98564736629 * (jd - 2_451_545) +
    0.000387933 * centuries * centuries -
    (centuries * centuries * centuries) / 38_710_000;

  return normalizeDegrees(greenwich + longitude);
}

export function starToHorizontal(
  star: CatalogStar,
  observer: Observer,
  date: Date,
): HorizontalPosition {
  const horizon = Astronomy.Horizon(
    date,
    new Astronomy.Observer(
      observer.latitude,
      observer.longitude,
      observer.elevationMeters ?? 0,
    ),
    star.rightAscensionHours,
    star.declinationDegrees,
    "normal",
  );

  return {
    altitude: horizon.altitude,
    azimuth: normalizeDegrees(horizon.azimuth),
  };
}

export function basicStarToHorizontal(
  star: CatalogStar,
  observer: Observer,
  date: Date,
): HorizontalPosition {
  const latitude = observer.latitude * DEG_TO_RAD;
  const declination = star.declinationDegrees * DEG_TO_RAD;
  const hourAngle =
    normalizeDegrees(
      localSiderealDegrees(date, observer.longitude) -
        star.rightAscensionHours * 15,
    ) * DEG_TO_RAD;

  const altitude = Math.asin(
    Math.sin(declination) * Math.sin(latitude) +
      Math.cos(declination) * Math.cos(latitude) * Math.cos(hourAngle),
  );

  const azimuth =
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitude) -
        Math.tan(declination) * Math.cos(latitude),
    ) *
      RAD_TO_DEG +
    180;

  return {
    altitude: altitude * RAD_TO_DEG,
    azimuth: normalizeDegrees(azimuth),
  };
}

export function skyQuality(observer: Observer, date: Date) {
  const astroObserver = new Astronomy.Observer(
    observer.latitude,
    observer.longitude,
    observer.elevationMeters ?? 0,
  );
  const moon = Astronomy.Horizon(
    date,
    astroObserver,
    Astronomy.Equator(Astronomy.Body.Moon, date, astroObserver, true, true).ra,
    Astronomy.Equator(Astronomy.Body.Moon, date, astroObserver, true, true).dec,
    "normal",
  );
  const sun = Astronomy.Horizon(
    date,
    astroObserver,
    Astronomy.Equator(Astronomy.Body.Sun, date, astroObserver, true, true).ra,
    Astronomy.Equator(Astronomy.Body.Sun, date, astroObserver, true, true).dec,
    "normal",
  );
  const moonIllumination = Astronomy.Illumination(Astronomy.Body.Moon, date);

  return {
    moonAltitude: moon.altitude,
    moonPhaseFraction: moonIllumination.phase_fraction,
    sunAltitude: sun.altitude,
    twilight:
      sun.altitude < -18
        ? "astronomical night"
        : sun.altitude < -12
          ? "astronomical twilight"
          : sun.altitude < -6
            ? "nautical twilight"
            : sun.altitude < 0
              ? "civil twilight"
              : "daylight",
  };
}

export function angularDistance(
  first: HorizontalPosition,
  second: HorizontalPosition,
) {
  const altitudeA = first.altitude * DEG_TO_RAD;
  const altitudeB = second.altitude * DEG_TO_RAD;
  const azimuthDelta = (first.azimuth - second.azimuth) * DEG_TO_RAD;
  const cosine =
    Math.sin(altitudeA) * Math.sin(altitudeB) +
    Math.cos(altitudeA) * Math.cos(altitudeB) * Math.cos(azimuthDelta);

  return Math.acos(Math.max(-1, Math.min(1, cosine))) * RAD_TO_DEG;
}
