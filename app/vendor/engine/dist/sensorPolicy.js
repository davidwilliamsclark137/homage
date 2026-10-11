"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGravity = normalizeGravity;
exports.plausibleGravity = plausibleGravity;
exports.plausibleMagneticField = plausibleMagneticField;
exports.advancingSample = advancingSample;
/** Normalize to gravity down, in g. iOS can subtract user acceleration. */
function normalizeGravity(platform, value, acceleration) {
    if (platform === 'android')
        return { x: -value.x, y: -value.y, z: -value.z };
    return {
        x: (value.x - (acceleration?.x ?? 0)) / 9.80665,
        y: (value.y - (acceleration?.y ?? 0)) / 9.80665,
        z: (value.z - (acceleration?.z ?? 0)) / 9.80665,
    };
}
function plausibleGravity(v) {
    const length = Math.hypot(v.x, v.y, v.z);
    return Number.isFinite(length) && length >= 0.8 && length <= 1.2;
}
/** Broad terrestrial field check, not proof of magnetic calibration. */
function plausibleMagneticField(v) {
    const length = Math.hypot(v.x, v.y, v.z);
    return Number.isFinite(length) && length >= 15 && length <= 100;
}
/** Native timestamps are monotonic seconds, NOT epoch milliseconds. */
function advancingSample(previous, next) {
    return Number.isFinite(next) && next >= 0 && (previous === null || next > previous);
}
