# Homage portal continuous integration

The portal app lives in `app`. GitHub Actions validates every branch push and
pull request, and supports a manual run. It uses the Node version in `.nvmrc`,
`npm ci`, committed engine sources and scene data, and pinned map build tools.
It needs no Expo credentials, running tunnel, second repository, or session data.

Locally, from a fresh checkout:

```sh
cd app
npm ci
npm run ci
```

The workflow rebuilds the vendored star engine and embedded 3D map, rejects drift
between generated and committed assets, runs TypeScript/lint and behavioral
checks, then creates production-mode JavaScript/assets bundles for iOS and
Android. Reports and bundles are retained as GitHub Actions artifacts. Shared
walk tests use temporary storage and never create participants in the live app.

`npm run check:live` remains an operational check for the running Expo preview.
It is deliberately separate from CI. CI does not restart that preview, change
saved progress, send an EAS update, build signed native apps, or deploy the shared
walk server. GPS, compass, camera, sound quality and real two-phone interactions
still need the field checklist in `app/TESTING.md`.

The map's original data export (`export-mckinney-map.py`) is an optional authoring
step requiring the separate McKinney engine. Normal app builds use its committed
scene snapshot and do not require that engine checkout.

The recovery checkpoint is `checkpoint/shared-walk-2026-10-11` locally, with a
matching `codex/shared-walk-checkpoint` recovery branch published to GitHub.
The CI changes are proposed separately on `codex/shared-walk-ci`. GitHub `main`
contains an older app, so this PR targets the recovery branch. No default-branch
replacement or automatic deployment is performed.

Use a separate checkout of the recovery branch to inspect or restore a version;
do not reset the active preview directory or copy ignored shared-session files
into Git. Preserve session storage when deliberately switching a running server.

Next: after reviewing/merging this workflow, configure the resulting check as
required on the chosen development branch. Branch protection is not established
merely by adding a workflow. Separate Expo preview/production channels, signed
builds, hosted shared-session storage and release/rollback automation remain
separate follow-up work.
