"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyHold = void 0;
exports.advanceSkyHold = advanceSkyHold;
const emptyHold = () => ({
    target: null,
    elapsed: 0,
    last: 0,
    outsideSince: null,
    tracking: false,
});
exports.emptyHold = emptyHold;
// Start close to the anchor, then tolerate small hand/compass jitter.
// Time outside the aiming area never counts toward capture.
function advanceSkyHold(previous, now, target, ready, offset) {
    if (!ready ||
        !target ||
        !Number.isFinite(now) ||
        !Number.isFinite(offset) ||
        offset < 0)
        return (0, exports.emptyHold)();
    let state = previous;
    if (state.target !== target || now < state.last || now - state.last > 500)
        state = (0, exports.emptyHold)();
    if (!state.tracking)
        return offset <= 7
            ? { target, elapsed: 0, last: now, outsideSince: null, tracking: true }
            : (0, exports.emptyHold)();
    if (state.outsideSince !== null && now - state.outsideSince > 400) {
        return offset <= 7
            ? { target, elapsed: 0, last: now, outsideSince: null, tracking: true }
            : (0, exports.emptyHold)();
    }
    if (offset > 10) {
        const outsideSince = state.outsideSince ?? now;
        if (now - outsideSince > 400)
            return (0, exports.emptyHold)();
        return { ...state, last: now, outsideSince };
    }
    return {
        ...state,
        last: now,
        outsideSince: null,
        elapsed: Math.min(3000, state.elapsed + (state.outsideSince === null ? now - state.last : 0)),
    };
}
