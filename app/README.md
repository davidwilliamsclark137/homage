# Homage Portals

Launch with `npm run start:tunnel` on Node 24. Expo Go opens directly to the 3D map on port 8084.

`app/index.tsx` loads `features/mckinney/screens/RooftopPortalScreen.tsx`. The historical filename is retained, but the screen covers all eight portals. `portalHtml.ts` contains the extracted animated portal renderer. `portals/mapAccess.ts` owns proximity discovery and entry rules; `map/embedded.json` bundles the existing McKinney model and Three.js viewer.

Run `npm run check` for code and geometry/location tests, or `npm run check:live` for the public Expo link and both native bundles. See TESTING.md for phone checks.

The Expo project identity is unchanged. This is a development preview, not a production EAS release. The map is a snapshot; export updated engine geometry and rebuild the embedded map deliberately when needed. Keep bundled third-party licenses and source attribution.
