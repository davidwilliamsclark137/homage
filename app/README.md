# Homage — downtown walk

One small journey around downtown McKinney: start at MPAC, find a hidden portal near Goodies Texas, finish outside Landon Winery, and save a keepsake on the phone.

## Run

Node 24, `npm ci`, `npm run start:tunnel`, then open the printed Expo Go link. Same Expo identity: `davidwilliamsclark/homage`, project `e8dd5376-de0c-45e6-bc68-ee6ddff3fc4d`. A GitHub checkpoint does not publish an EAS update.

`npm run check` verifies the pure journey engine and app. `npm run check:live` adds development-server availability. See TESTING.md for real-phone tests.

## Structure

- `journey/engine.ts`: ordered activation, location quality/freshness, arrival settling, validated progress. No React or networking; future two-player coordination can use this boundary. A real multiplayer service must authoritatively validate its own progress; client GPS gates are not anti-cheat.
- `journey/places.json`: three provisional ground-level positions with provenance.
- `journey/downtown.json`: cropped 2D footprint/street snapshot from the existing McKinney model. The external engine is not modified or required at runtime.
- `journey/Map.tsx`: bundled north-up schematic, visible current portal, hidden-nearby marker, and player position.
- `journey/JourneyScreen.tsx`: foreground GPS, explicit activation, local save/recovery, completion, field notes.

No accounts, remote game backend, star scanning, motion/camera permissions, rooftop checks, or alternate games are included. Previous AsyncStorage keys are untouched. New progress is under `homage:journey:downtown-three-v1`.

## Checkpoint and next phase

Full experiments are preserved locally at tag `checkpoint/pre-downtown-walk-2026-10-05` and on GitHub branch `codex/checkpoint-pre-downtown-walk-2026-10-05`. The snapshot trees match. The old two-phone flows can be recovered there. This branch is `codex/downtown-walk`.

Two-phone play remains the next phase after the solo walk is field proven. Pairing, separate clues, and shared completion should build on the small journey engine, not restore the old menu.

## Map attribution

Map geometry is derived from OpenStreetMap contributors via the McKinney engine; © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright . Full source provenance is in `journey/downtown.json`; placements are estimates and need field verification.
