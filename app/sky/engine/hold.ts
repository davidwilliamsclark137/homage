export type SkyHold = { target: string | null; elapsed: number; last: number; outsideSince: number | null; tracking: boolean };
export const emptyHold = (): SkyHold => ({ target: null, elapsed: 0, last: 0, outsideSince: null, tracking: false });

// Start close to the anchor, then tolerate small hand/compass jitter.
// Time outside the aiming area never counts toward capture.
export function advanceSkyHold(previous: SkyHold, now: number, target: string | null, ready: boolean, offset: number): SkyHold {
  if (!ready || !target || !Number.isFinite(offset)) return emptyHold();
  let state = previous;
  if (state.target !== target || now < state.last || now - state.last > 500) state = emptyHold();
  if (!state.tracking) return offset <= 7 ? { target, elapsed: 0, last: now, outsideSince: null, tracking: true } : emptyHold();
  if (offset > 10) {
    const outsideSince = state.outsideSince ?? now;
    if (now - outsideSince > 400) return emptyHold();
    return { ...state, last: now, outsideSince };
  }
  return { ...state, last: now, outsideSince: null, elapsed: Math.min(3000, state.elapsed + (state.outsideSince === null ? now - state.last : 0)) };
}
