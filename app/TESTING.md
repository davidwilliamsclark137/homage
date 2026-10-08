# 3D portal field test

## Before leaving

1. Open this version's port-8084 Expo Go link. The first screen must be the 3D map, not a menu or the three-stop walking journey.
2. Drag, pinch, rotate, and use Overview. Buildings, terrain, street labels, and five initially visible portal markers should render. Three hidden portals are absent without nearby accurate GPS.
3. Select Landon from the map or its chip. Check the title and details. Preview portal should open the animated artwork with an explicit preview label. Back to map must restore the 3D map and selected portal.
4. Deny location: the map and preview still work, while real entry remains unavailable. Allow precise foreground location in Expo Go settings, then Retry GPS.

## Outdoors

1. Approach a ground-level storefront portal on public pedestrian space. With a fresh fix (at most 30 seconds old) and accuracy within 20 m, Enter portal enables within the existing 18 m radius.
2. Goodies, Fair & Square, and TUPPS are hidden until nearby. Walk away: their marker and chip disappear. If selected or open, the hidden portal must close when its eligibility is lost.
3. Background Homage while a portal is open; return and verify that fresh GPS is needed. Turn off location or lose signal: stale readings must not keep entry enabled.
4. Try directions, then return to Homage. Use marked crossings. All placements are model estimates and need an on-site check; do not enter restricted space to chase a marker.
5. Rooftop is experimental: preview works, but actual entry uses an iOS-only altitude gate. Android must not claim the correct floor. Do not treat GPS altitude as verified top-deck detection.

No camera, sky scan, login, second phone, or backend game service is needed in this version. Two-phone play is a later phase. Automated checks cannot establish physical GPS reliability, walking access, or hardware rendering performance.
