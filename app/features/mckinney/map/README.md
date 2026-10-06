# Homage portal map

A self-contained Three.js map embedded in the rooftop-portal screen, linked as
**Explore portal map** from the home page.

scene.json is a bounded snapshot of the McKinney engine's 1,140 building
polygons, 377 roads, and a 33 × 33 crop of its retained terrain grid.
Source identifiers and source-file hashes are preserved. Terrain is historical
surface elevation, including buildings and vegetation, not surveyed bare ground.
Building heights are inferred where the source lacks measurements.

The Chestnut Commons portal is anchored to its footprint and rendered 12 m
above the sampled model base (with the ring centre 7 m above the roof for
visibility). No user placement or calibration is required. The phone's live
location is passed to the embedded map, not uploaded to the model server.
Stale or inaccurate positions are hidden. The experimental iOS height gate is
separate from the marker and is not reliable verification of a specific floor.

Tap the marker to open native details, walking directions, or entry. Preview
explicitly bypasses location. Buildings are merged into two meshes and roads
into one line-segment batch. No external assets or engine server are needed.

## Rebuild

From app/, using the engine's installed Three.js 0.180.0 and esbuild:

    python3 scripts/export-mckinney-map.py
    node scripts/build-portal-map.cjs

Set MCKINNEY_ENGINE if that checkout is elsewhere. These commands only read the
engine and write derived artifacts here. embedded.json includes the viewer,
snapshot, Three.js, OrbitControls, and geometry utilities. The Three.js license
is retained in THREE-LICENSE.txt.

## Validation

    node scripts/verify-rooftop.cjs
    node scripts/verify-portal-map.cjs
    npx tsc --noEmit
    npm run lint

Physical iPhone GPU behavior, field altitude accuracy, and top-deck unlocking
must still be observed on the actual device.

## Storefront portals

mapPortals.json is the shared map/native catalog. It includes Chestnut Commons
and three sidewalk portals at Landon Winery, Emporium Pies, and Patina Green.
Business address sources and check dates are stored per portal. Storefront
points are inferred about 2 m outside the street-facing model wall, not surveyed
door locations. They activate within 18 m using a fresh horizontal fix with
reported accuracy at most 20 m; they do not gate on altitude or shop hours.

The map/native bridge carries the selected portal ID, validates it against the
catalog, and updates readiness independently for each marker. Directions and
fractal previews follow that selected record. No business entry is required.

## Transient hidden portals

Goodies Texas, Fair & Square Imports, and TUPPS Brewery are hiddenUntilNearby storefronts.
They appear only with a fresh, accurate fix within 18 m, and disappear as soon
as the next fix is outside that radius. Unknown, erroneous, or stale location
also hides them. The shared isPortalVisible rule governs native lists/selection
and the embedded map's buttons, rings, and beacons, including initial load.
Leaving range closes selected details and any open field/preview experience.
Discovery is not persisted. Existing four portals keep their normal visibility.
Coordinates remain in the shipped client catalog; this is gameplay concealment,
not protection against someone inspecting app assets.

TUPPS uses the west-facing wall of northern mill building `way/664455817`
(City address object 77812, 402 E Louisiana St building 2), offset 2 m outdoors.
The official venue contact page confirms the address and west-side parking.
This is a model-based visitor approach estimate, not a surveyed entrance.

The night encounter also uses an outdoor MPAC meeting portal at the north wall
of way/472387412, offset about 3 m. It is provisional and needs an on-site check.
See ../encounter/README.md for routes and encounter behavior.
