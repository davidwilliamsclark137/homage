# Homage mobile app

Homage is an Expo/React Native exploration game. The app discovers nearby public hubs, supports encrypted two-player message hunts, and builds location-aware puzzles from curated city packs.

## Run locally

```bash
npm install
npm run dev:render
```

`dev:render` uses the deployed Render backend. Keep credentials in the platform credential store or Render environment settings; do not add secrets to this repository.

## Project structure

```text
app/                  Expo Router entry points only
features/
  mckinney/
    data/             Sourced location records
    puzzles/          Puzzle templates and generation rules
    screens/          McKinney UI implementations
components/           Shared UI used by multiple features
lib/                  Cross-feature storage, crypto, geography, and utilities
sky/                  Astronomy engine and catalog
parked-routes/        Older routes retained for reference, not active navigation
```

Route files should remain small. A route normally re-exports a screen from its feature:

```ts
export { default } from "../features/mckinney/screens/McKinneyPackScreen";
```

## Feature boundaries

- A **location pack** contains sourced place data, coordinates, public-access rules, possible observations, and field-verification status.
- A **puzzle engine** turns records from a location pack into mechanics such as I Spy, bingo, a maze, or virtual capture-the-signal.
- A **screen** presents a feature but does not own canonical location facts.
- `lib/` is reserved for capabilities genuinely shared across features. City-specific files do not belong there.
- Backend API calls remain centralized until a later service-layer extraction can be done without destabilizing the deployed app.

## Adding another city

1. Create `features/<city>/data/locationPack.ts`.
2. Add official sources and mark visual details as unverified until checked in person.
3. Reuse general puzzle mechanics or add city-specific templates under `features/<city>/puzzles/`.
4. Add screens under `features/<city>/screens/`.
5. Add thin Expo route files under `app/` only for navigable pages.

Never generate a location answer from an unsourced fact, and never mark a visual observation verified without an on-site check.

## Verification

```bash
npm run lint
npx tsc --noEmit
npx expo export --platform android
npx expo export --platform ios
```
