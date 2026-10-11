"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDegrees = normalizeDegrees;
exports.starToHorizontal = starToHorizontal;
exports.basicStarToHorizontal = basicStarToHorizontal;
exports.skyQuality = skyQuality;
exports.angularDistance = angularDistance;
const Astronomy = __importStar(require("astronomy-engine"));
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
}
function julianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
}
function localSiderealDegrees(date, longitude) {
    const jd = julianDate(date);
    const centuries = (jd - 2451545) / 36525;
    const greenwich = 280.46061837 +
        360.98564736629 * (jd - 2451545) +
        0.000387933 * centuries * centuries -
        (centuries * centuries * centuries) / 38710000;
    return normalizeDegrees(greenwich + longitude);
}
function starToHorizontal(star, observer, date) {
    // Catalog coordinates use J2000/ICRS, whereas Horizon needs equator of date.
    const vector = Astronomy.VectorFromSphere(new Astronomy.Spherical(star.declinationDegrees, star.rightAscensionHours * 15, 1), date);
    const equator = Astronomy.EquatorFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), vector));
    const horizon = Astronomy.Horizon(date, new Astronomy.Observer(observer.latitude, observer.longitude, observer.elevationMeters ?? 0), equator.ra, equator.dec, 'normal');
    return {
        altitude: horizon.altitude,
        azimuth: normalizeDegrees(horizon.azimuth),
    };
}
function basicStarToHorizontal(star, observer, date) {
    const latitude = observer.latitude * DEG_TO_RAD;
    const declination = star.declinationDegrees * DEG_TO_RAD;
    const hourAngle = normalizeDegrees(localSiderealDegrees(date, observer.longitude) - star.rightAscensionHours * 15) * DEG_TO_RAD;
    const altitude = Math.asin(Math.sin(declination) * Math.sin(latitude) +
        Math.cos(declination) * Math.cos(latitude) * Math.cos(hourAngle));
    const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude) -
        Math.tan(declination) * Math.cos(latitude)) *
        RAD_TO_DEG +
        180;
    return {
        altitude: altitude * RAD_TO_DEG,
        azimuth: normalizeDegrees(azimuth),
    };
}
function skyQuality(observer, date) {
    const astroObserver = new Astronomy.Observer(observer.latitude, observer.longitude, observer.elevationMeters ?? 0);
    const moon = Astronomy.Horizon(date, astroObserver, Astronomy.Equator(Astronomy.Body.Moon, date, astroObserver, true, true).ra, Astronomy.Equator(Astronomy.Body.Moon, date, astroObserver, true, true).dec, 'normal');
    const sun = Astronomy.Horizon(date, astroObserver, Astronomy.Equator(Astronomy.Body.Sun, date, astroObserver, true, true).ra, Astronomy.Equator(Astronomy.Body.Sun, date, astroObserver, true, true).dec, 'normal');
    const moonIllumination = Astronomy.Illumination(Astronomy.Body.Moon, date);
    return {
        moonAltitude: moon.altitude,
        moonPhaseFraction: moonIllumination.phase_fraction,
        sunAltitude: sun.altitude,
        twilight: sun.altitude < -18
            ? 'astronomical night'
            : sun.altitude < -12
                ? 'astronomical twilight'
                : sun.altitude < -6
                    ? 'nautical twilight'
                    : sun.altitude < 0
                        ? 'civil twilight'
                        : 'daylight',
    };
}
function angularDistance(first, second) {
    const altitudeA = first.altitude * DEG_TO_RAD;
    const altitudeB = second.altitude * DEG_TO_RAD;
    const azimuthDelta = (first.azimuth - second.azimuth) * DEG_TO_RAD;
    const cosine = Math.sin(altitudeA) * Math.sin(altitudeB) +
        Math.cos(altitudeA) * Math.cos(altitudeB) * Math.cos(azimuthDelta);
    return Math.acos(Math.max(-1, Math.min(1, cosine))) * RAD_TO_DEG;
}
