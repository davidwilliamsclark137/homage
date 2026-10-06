# Homage

The active mobile app is a small downtown McKinney walking journey. Start at MPAC, discover a hidden portal, and finish with a keepsake saved on the phone.

See [app/README.md](app/README.md) for architecture and launch instructions and [app/TESTING.md](app/TESTING.md) for the first outdoor test.

```sh
cd app
npm ci
npm run start:tunnel
```

Use Node 24. The Expo identity remains `davidwilliamsclark/homage`. The current prototype does not use a remote game backend. Existing `backend/`, deployment files, and older developer scripts are retained as legacy infrastructure; they are not needed to run this walking app and were not redeployed.

Two-phone play remains planned. Prior sky, rooftop, and multiplayer experiments are preserved on GitHub in `codex/checkpoint-pre-downtown-walk-2026-10-05` and locally under the corresponding checkpoint tag. Current development is on `codex/downtown-walk`.
