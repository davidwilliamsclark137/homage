# Homage sky engine

Pure TypeScript; no React, Expo, camera, network, pairing, or city dependency.
Import the public API from `sky/engine`. Runtime dependency: astronomy-engine.
Existing `sky/*.ts` paths are compatibility re-exports.

## Pipeline

1. `skyTargets(observer, date, mode)` computes nighttime catalog targets. `pattern`
   requires the whole pattern above 12°; `anchor` requires only its bright star.
   Both reject targets above 80° and sunlight above -6°.
2. `cameraDirection(gravity, magneticField, declinationDegrees)` converts device
   axes to rear-camera heading, altitude, and roll. Gravity points down; the rear
   camera looks along -z. Heading is clockwise from true north. Invalid or
   degenerate vectors return null.
3. `projectStars` draws those directions in the camera view using approximate
   field of view, not a calibrated optical model.
4. `alignmentStatus(snapshot, optionalRegion)` checks location, sensor freshness,
   quality, and aim. No city restriction unless explicitly supplied.
5. `advanceSkyHold(previous, nowMs, targetId, ready, offsetDegrees)` starts within
   7°, retains acquisition within 10°, pauses outside for at most 400 ms, and
   captures after 3000 ms. Invalid sensors, changed targets, backwards time, and
   gaps over 500 ms reset the hold. Never count off-target time.

Pass one current clock sample taken after the sensor snapshot; stale UI tick
values can falsely classify new sensor readings as future-dated.

## Integration

`../useSkyPose.ts` is the Expo adapter: permissions, calibrated magnetic readings,
location, true-north correction, lifecycle, and device-axis normalization.
`../SkyScanner.tsx` is the shared camera/scan UI. `app/sky-lab.tsx` uses anchor mode
without a region; the McKinney encounter wrapper supplies its downtown boundary.
Both use the same engine and hold logic. No scan uploads camera frames or GPS.
The lab's optional share sheet contains an explicit result summary without GPS
coordinates or images. A result is temporary until the user shares or copies it.

## Verification

From app/: `node scripts/verify-night-sky.cjs` (also part of `npm run check`).
Covers astronomy, city policy, freshness, invalid data, 54 rear-camera direction
combinations, declination, and lock acquisition/reset/jitter behavior.

On each physical phone, open **Sky scanning lab** after dark. Choose the same
star, confirm the marker against the visible star, and capture three times.
Check clockwise heading, upward tilt, look-away reset, background/restart, and
repeatability. Save a screenshot of diagnostics for a failed attempt; share the
result for a successful one. Synthetic passing tests do not establish physical
calibration. This is directional acquisition, not image-based star recognition.
