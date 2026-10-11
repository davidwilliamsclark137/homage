"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAR_CATALOG_SOURCE = exports.HIPPARCOS_STARS = void 0;
const hipparcos_naked_eye_json_1 = __importDefault(require("./hipparcos.naked-eye.json"));
const tuples = hipparcos_naked_eye_json_1.default.stars;
exports.HIPPARCOS_STARS = tuples.map(([hip, rightAscensionDegrees, declinationDegrees, magnitude, colorIndex]) => ({
    id: `hip-${hip}`,
    name: `HIP ${hip}`,
    rightAscensionHours: rightAscensionDegrees / 15,
    declinationDegrees,
    magnitude,
    colorIndex,
}));
exports.STAR_CATALOG_SOURCE = hipparcos_naked_eye_json_1.default.source;
