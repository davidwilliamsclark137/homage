"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skyTargets = skyTargets;
const astronomy_1 = require("./astronomy");
const catalog_1 = require("./catalog");
function skyTargets(observer, date, mode = 'pattern') {
    if ((0, astronomy_1.skyQuality)(observer, date).sunAltitude > -6)
        return [];
    return catalog_1.CONSTELLATIONS.map((c) => {
        const stars = c.stars.map((s) => (0, astronomy_1.starToHorizontal)(s, observer, date));
        const brightest = c.stars.reduce((a, b) => (a.magnitude < b.magnitude ? a : b));
        const target = (0, astronomy_1.starToHorizontal)(brightest, observer, date);
        return {
            constellation: c,
            anchor: brightest.name,
            target,
            available: (mode === 'anchor'
                ? target.altitude >= 12
                : stars.every((s) => s.altitude >= 12)) && target.altitude <= 80,
        };
    })
        .filter((c) => c.available)
        .sort((a, b) => b.target.altitude - a.target.altitude);
}
