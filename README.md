# Homage — 3D portals

This focused app opens directly into the downtown McKinney 3D map. All eight original map portals remain, including three hidden-nearby portals, the rooftop experiment, storefronts, and MPAC. Select a portal, see its details, approach it to enter, or explicitly preview its animated content.

The map is bundled from the McKinney engine. No live engine process is required. Source geometry, terrain, portal placements, and asset provenance have been preserved unchanged.

## Run

Use Node 24:

```sh
cd app
npm ci
npm run start:tunnel
```

This branch uses port 8084, independently of the walking prototype (8081) and full experiment preview (8083). Open the printed link in Expo Go. No EAS update is published by starting this server.

## What remains

- One map screen and its animated portal viewer.
- Foreground GPS, stale/inaccurate fix rejection, and transient hidden discovery.
- Existing rooftop gate and its experimental limitations: iOS altitude only, no claim of verified floor detection. Android still supports ground-level portals and rooftop preview.
- McKinney model export/build scripts and focused regression checks.

Sky scanning, account/capture flows, alternate games, and multiplayer relays are removed from the active mobile app. Two-phone play is deferred, preserved in the full checkpoint. Legacy backend files remain in the repository for recovery but are not called by this app.

## Recovery

- Full experiments: `checkpoint/pre-downtown-walk-2026-10-05` locally and GitHub branch `codex/checkpoint-pre-downtown-walk-2026-10-05`.
- Latest walking prototype plus backend edits: local tag `checkpoint/before-3d-portals-2026-10-08` and GitHub branch `codex/checkpoint-before-3d-portals-2026-10-08`.
- Focused version: `codex/portal-map-only`.

See [app/TESTING.md](app/TESTING.md) before field testing. Existing phone saves and other worktrees are untouched.
