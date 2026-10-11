"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alignmentStatus = alignmentStatus;
exports.alignmentGate = alignmentGate;
const astronomy_1 = require("./astronomy");
function distanceMeters(a, b) {
    const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function alignmentStatus(input, region) {
    const fresh = (t, max) => t !== null && input.now - t >= 0 && input.now - t <= max;
    if (!Number.isFinite(input.now))
        return { aligned: false, message: 'Invalid clock.' };
    if (input.observer &&
        (![input.observer.latitude, input.observer.longitude].every(Number.isFinite) ||
            Math.abs(input.observer.latitude) > 90 ||
            Math.abs(input.observer.longitude) > 180))
        return { aligned: false, message: 'Invalid location.' };
    if (!input.observer)
        return { aligned: false, message: 'Waiting for your GPS location.' };
    if (region && distanceMeters(input.observer, region.center) > region.radiusMeters)
        return { aligned: false, message: 'Move inside the configured scan area.' };
    if (input.accuracy === null ||
        !Number.isFinite(input.accuracy) ||
        input.accuracy < 0 ||
        input.accuracy > 20 ||
        !fresh(input.locationTimestamp, 30000))
        return {
            aligned: false,
            message: `Waiting for fresh GPS accuracy of 20 m or better (now ${input.accuracy === null ? 'unknown' : Math.round(input.accuracy) + ' m'}).`,
        };
    if (input.headingAccuracy !== 3 ||
        !fresh(input.qualityTimestamp, 120000) ||
        !fresh(input.headingTimestamp, 1000))
        return {
            aligned: false,
            message: `Compass not ready (${input.headingAccuracy}/3). Move away from cars, metal, and the other phone; gently move this phone in a figure eight, then rotate slowly to refresh quality.`,
        };
    if (!fresh(input.motionTimestamp, 1000))
        return {
            aligned: false,
            message: 'Waiting for motion readings. Check Sensors permission, then restart sky sensors.',
        };
    if (!input.target)
        return { aligned: false, message: 'Choose an available constellation.' };
    const offset = (0, astronomy_1.angularDistance)(input.target, {
        azimuth: input.heading,
        altitude: input.altitude,
    });
    if (!Number.isFinite(offset))
        return { aligned: false, message: 'Waiting for a valid sky direction.' };
    return {
        ready: true,
        offset,
        aligned: offset <= 7,
        message: `Anchor is ${offset.toFixed(1)}° from center. Bring it within 7° and hold steady.`,
    };
}
function alignmentGate(input) {
    return alignmentStatus(input).aligned;
}
