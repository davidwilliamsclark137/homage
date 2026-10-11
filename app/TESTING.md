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

## Proximity chord

- Tap **Try the sound**: an eight-second demo starts dissonant, resolves over six seconds, then stops. It does not change GPS, reveal portals, or grant entry.
- In Expo Go with fresh, precise GPS, walk from outside 60 m toward a portal. A quiet dissonant chord fades in, then blends into a tuned chord at the existing entry radius (18 m for storefronts).
- Use TUPPS to test a hidden portal without nearby competing signals: sound precedes its map reveal. Walk away; it becomes dissonant and fades out beyond 60 m.
- Mute/unmute, background/foreground, and open/close portal previews: audio must stop while muted, backgrounded, or viewing a portal. A fresh GPS fix is required after returning.
- Deny location or allow its fix to expire: no proximity sound. The sound demo remains available.
- Test both iPhone and GrapheneOS speaker/headphones. Check media volume. Nearby portals share a nearest-signal cue with a five-metre switching margin. Rooftop audio cannot fully resolve without passing the existing altitude gate.

## Portal activities from home

Enable Show hidden portals and preview each of the eight portals. Every preview
starts an activity without requiring GPS, recording a visit, or unlocking a portal.

- Landon: toggle three notes and blend them; clue appears after playback.
- Emporium: turn the slice three times to fit the top-right gap.
- Patina: choose an observation; its visual and clue change state.
- Goodies: watch 1, 3, 2; a wrong tap resets matching; the correct sequence reveals the clue.
- Fair & Square: move both halves to the middle column.
- TUPPS: select all layers, then play the rhythm.
- MPAC: choose three motifs in any order and play that order.
- Rooftop: an interrupted hold must not complete; a three-second hold does.

For sound activities, test mute during playback, restart, backgrounding, and back
to map. Playback must stop on leaving/backgrounding; muted queued notes must
remain silent. Start again clears local activity state. View portal animation
retains access to the original visuals; returning to the activity starts fresh.

## Branching preview journey

Tap Try a portal journey. Complete Landon, then choose Emporium or Patina.
Emporium leads to Fair & Square; Patina leads through Goodies to Fair & Square.
At Fair & Square, choose TUPPS or go straight to the MPAC finale. Every connection
must wait for activity completion. Back to map and Continue preview journey must
retain the current stop and completed fragments. End preview journey clears only
this in-memory preview. Reload starts fresh. This prototype deliberately reveals
hidden portals for browsing and never changes GPS entry requirements or records
visits. Rooftop remains independently previewable with a graph connection to Landon.

## Shared walk — two phones, live or later

Open **A shared walk** on each phone. For an indoor test choose **Rehearsal**
on both. Start phone A with no code, then enter its code on phone B before
starting. Rehearsals are isolated from outdoor matching. A third phone must not
join a full session. Phone A starts at Landon; phone B starts at Patina.

1. Pick and listen to a fragment on each phone. Deposit each. Both screens should
   show the other contribution. Go to MPAC on the map using Show destination.
   Reopen A shared walk and verify progress remains.
2. Rehearse arrival at MPAC. Each phone can play the combined composition.
   One phone opting to meet must not show mutual agreement. Both opting in while
   foregrounded should show the clearly labeled rehearsal agreement. Withdraw
   either invitation; it must disappear on the other phone within one poll.
3. Background phone B for 25 seconds. Phone A must describe an earlier/away
   participant and stop showing a live meeting. Foreground B and explicitly
   opt into meeting again. No coordinates or names are sent to the service.
4. Both request another walk; begin it on one phone. Both return to fragment
   selection with swapped roles. No previous consent carries forward.
5. Close/reopen Expo Go. The same anonymous session should restore. Cut network
   access and verify a connection error, no fake partner and no claimed save.
   Restore network, retry; a repeated deposit must not duplicate contributions.
6. Withdraw on phone B. Phone A loses the partner and mutual agreements. Withdraw
   A too to clean up the rehearsal. Never use outdoor matching for automated tests.

For the outdoor test, select **Outdoor walk**. Contribution and MPAC arrival
require fresh, accurate local GPS within the existing storefront radius. Denied,
stale, backgrounded or inaccurate GPS must block these actions. A rehearsal must
never satisfy an outdoor session. Placements still need on-site checking.
GPS gating is a prototype client check, not a server-verified proof of presence.

For asynchronous outdoor testing: A deposits at Landon and leaves the shared
screen. B starts without a code later and receives A's earlier fragment, then
contributes at Patina. Either can visit MPAC and enjoy the finale without waiting
for the other. Check that earlier contributions are never represented as a live
meeting. Use public pedestrian space; no purchase or business entry is needed.

The service is mounted on the same Expo tunnel, stores private state in
`../tmp/shared-walk/state.json`, and survives an Expo restart. Anonymous sessions
expire after 48 hours. This prototype has no push notifications, chat, persistent
friend list or synchronized audio playback between devices. Restarting the walk
replaces its temporary composition; it is not a permanent keepsake archive.
