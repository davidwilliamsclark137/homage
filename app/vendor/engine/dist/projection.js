"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectStars = projectStars;
exports.calculateHorizontalStars = calculateHorizontalStars;
exports.projectHorizontalStars = projectHorizontalStars;
exports.constellationCenter = constellationCenter;
const astronomy_1 = require("./astronomy");
const DEG_TO_RAD = Math.PI / 180;
function horizontalVector(position) {
    const altitude = position.altitude * DEG_TO_RAD;
    const azimuth = position.azimuth * DEG_TO_RAD;
    return [
        Math.cos(altitude) * Math.sin(azimuth),
        Math.cos(altitude) * Math.cos(azimuth),
        Math.sin(altitude),
    ];
}
function projectStars({ stars, observer, date, pose, width, height, horizontalFovDegrees, verticalFovDegrees, }) {
    return projectHorizontalStars({
        stars: stars.map((star) => ({
            ...star,
            ...(0, astronomy_1.starToHorizontal)(star, observer, date),
        })),
        pose,
        width,
        height,
        horizontalFovDegrees,
        verticalFovDegrees,
    });
}
function calculateHorizontalStars(stars, observer, date) {
    return stars.map((star) => ({
        ...star,
        ...(0, astronomy_1.starToHorizontal)(star, observer, date),
    }));
}
function projectHorizontalStars({ stars, pose, width, height, horizontalFovDegrees = 52, verticalFovDegrees = 68, visibleOnly = false, }) {
    const heading = (0, astronomy_1.normalizeDegrees)(pose.heading) * DEG_TO_RAD;
    const altitude = pose.altitude * DEG_TO_RAD;
    const roll = pose.roll * DEG_TO_RAD;
    const forward = [
        Math.cos(altitude) * Math.sin(heading),
        Math.cos(altitude) * Math.cos(heading),
        Math.sin(altitude),
    ];
    const levelRight = [Math.cos(heading), -Math.sin(heading), 0];
    const levelUp = [
        -Math.sin(altitude) * Math.sin(heading),
        -Math.sin(altitude) * Math.cos(heading),
        Math.cos(altitude),
    ];
    const right = [
        levelRight[0] * Math.cos(roll) + levelUp[0] * Math.sin(roll),
        levelRight[1] * Math.cos(roll) + levelUp[1] * Math.sin(roll),
        levelRight[2] * Math.cos(roll) + levelUp[2] * Math.sin(roll),
    ];
    const up = [
        -levelRight[0] * Math.sin(roll) + levelUp[0] * Math.cos(roll),
        -levelRight[1] * Math.sin(roll) + levelUp[1] * Math.cos(roll),
        -levelRight[2] * Math.sin(roll) + levelUp[2] * Math.cos(roll),
    ];
    // These starting values approximate a standard phone camera in portrait.
    // The nudge controls compensate for device-specific camera and sensor offsets.
    const horizontalFov = horizontalFovDegrees * DEG_TO_RAD;
    const verticalFov = verticalFovDegrees * DEG_TO_RAD;
    const focalX = width / (2 * Math.tan(horizontalFov / 2));
    const focalY = height / (2 * Math.tan(verticalFov / 2));
    const projected = [];
    for (const star of stars) {
        const starAltitude = star.altitude * DEG_TO_RAD;
        const starAzimuth = star.azimuth * DEG_TO_RAD;
        const east = Math.cos(starAltitude) * Math.sin(starAzimuth);
        const north = Math.cos(starAltitude) * Math.cos(starAzimuth);
        const zenith = Math.sin(starAltitude);
        const cameraX = east * right[0] + north * right[1] + zenith * right[2];
        const cameraY = east * up[0] + north * up[1] + zenith * up[2];
        const cameraZ = east * forward[0] + north * forward[1] + zenith * forward[2];
        const x = width / 2 + focalX * (cameraX / Math.max(cameraZ, 0.001));
        const y = height / 2 - focalY * (cameraY / Math.max(cameraZ, 0.001));
        const inFront = cameraZ > 0;
        const onScreen = inFront && x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20;
        if (visibleOnly && !onScreen)
            continue;
        projected.push({
            ...star,
            x,
            y,
            inFront,
            onScreen,
        });
    }
    return projected;
}
function constellationCenter(stars) {
    const vectors = stars.map(horizontalVector);
    const sum = vectors.reduce((total, vector) => [
        total[0] + vector[0],
        total[1] + vector[1],
        total[2] + vector[2],
    ], [0, 0, 0]);
    const length = Math.hypot(...sum) || 1;
    const [east, north, up] = sum.map((value) => value / length);
    return {
        altitude: Math.asin(up) / DEG_TO_RAD,
        azimuth: (0, astronomy_1.normalizeDegrees)(Math.atan2(east, north) / DEG_TO_RAD),
    };
}
