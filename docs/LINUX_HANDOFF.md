# Homage Linux handoff

This guide moves local development from the Mac Studio to Linux without moving
Render data or copying credentials between machines.

## What remains hosted

- The FastAPI backend remains at `https://homage-backend.onrender.com`.
- Render keeps its environment variables and persistent `/data` disk.
- Expo/EAS remains project `e8dd5376-de0c-45e6-bc68-ee6ddff3fc4d`.
- Do not copy `.env`, `.expo`, credential-store, or API-key files from the Mac.

The repository ignores local environment files. The Render URL, Expo owner, and
EAS project ID committed in `app/app.config.js` are identifiers, not secrets.

## 1. Install the development tools

Install Git, `curl`, `lsof`, Node.js, and npm through the Linux distribution or
your preferred version manager. The repository pins Node in `.nvmrc`:

```bash
nvm install
nvm use
node --version
```

Install the ChatGPT desktop app for Linux and open the cloned repository as a
local Codex project. Alternatively, install the Codex CLI and run `codex` from
the repository root.

## 2. Clone the current app

```bash
git clone --branch recovered-antilythera --single-branch \
  https://github.com/davidwilliamsclark137/homage.git
cd homage
git status
```

The optional Nine Portals website is a separate OpenAI Sites repository and is
not required to run the Expo mobile app.

## 3. Install and verify the Expo app

```bash
cd app
npm ci
npm run lint
npx tsc --noEmit
npx expo export --platform web --output-dir /tmp/homage-web-check
```

## 4. Authenticate platform tooling

Use interactive login on Linux. Do not transfer session tokens from the Mac.

```bash
npx eas login
npx eas whoami
npx expo login
```

## 5. Start phone development against Render

```bash
npm run dev:render
```

Open the printed `exp://…exp.direct` URL in Expo Go on the iPhone and GrapheneOS
phone. Keep this terminal running during the first test. The Linux tunnel URL
may differ from the Mac tunnel URL.

The launcher defaults to the hosted Render backend. It does not need a local
backend key. Confirm backend health separately with:

```bash
curl -fsS https://homage-backend.onrender.com/healthz
```

## 6. Publish an EAS update

After verification:

```bash
npx eas update --branch production --message "Describe the update"
```

## 7. Cut over safely

1. Verify navigation, location permission, maps, and tuner audio on both phones.
2. Verify that multiplayer state still reaches the Render backend.
3. Keep the Mac Expo service available until the Linux test passes.
4. Create a Linux `systemd --user` service only after the manual command is
   reliable. Its working directory should be the cloned repository's `app/`
   folder and its command should be `npm run dev:render`.

## Everyday Git workflow

Before starting work:

```bash
git switch recovered-antilythera
git pull --ff-only
```

Commit focused changes and push the branch regularly. Merge into `main` only
after the current recovered build has been reviewed and tested.
