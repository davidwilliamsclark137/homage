# Two halves of the night

Home → **Find the same sky** is the outdoor journey. Home → **Test the night**
is the explicitly simulated two-phone journey. Neither replaces the earlier
**Try together** short bloom test.

## Outdoor start

The existing astronomy-engine calculations and constellation catalog determine
which supported patterns have every catalog star at least 12 degrees above the
horizon, a bright anchor below 80 degrees altitude, and the Sun below -6 degrees.
The phone overlays the constellation on a live rear camera preview. It requires
GPS within 20 m and 30 seconds old, within 1.5 km of downtown, compass quality 3
with an update within three seconds, motion within one second, and alignment
within seven degrees of the bright anchor for three continuous seconds. Leaving
alignment or backgrounding resets the hold. There is no photo recognition,
cloud/building occlusion detection, or star-image verification; hardware alignment
still needs an outdoor iPhone check. No images or coordinates reach the relay.

After capturing, opt in within 60 seconds. Two active waiting participants who
scanned the same pattern within the 15-minute matching window receive one event
and complementary roles. A third participant waits for another event. Test and
field queues are isolated. Private 192-bit credentials stay on the owning phone;
snapshots expose only event progress and presence, never peer credentials.

## Story and route

`story.json` is the route/content source shared with the relay. Amber visits
Landon Winery and Patina Green. Teal visits Emporium Pies and Fair & Square.
The first collection changes the other phone's fragment and reveals its second
clue. Both paths end at `mpac-meeting` on the north side of MPAC. Each participant
must reach the final portal and explicitly share; fresh presence and both consents
are required to complete **Between us**. Each phone saves its own local keepsake.

Portal positions come from the existing McKinney model snapshot. MPAC uses the
north wall of `way/472387412`, offset approximately 3 m outdoors. This is a
provisional meeting point, not a surveyed entrance or verified accessible route.
The app provides walking directions and the existing interactive map. Hidden
portals remain hidden on that map until the normal proximity gate is met.

## Lifecycle and prototype limits

A separate `/homage-encounter` Metro endpoint holds the state machine. Records
are atomically saved with private file permissions under app/.expo/ and can resume
for two hours, including across server restarts. Foreground polling is every 2.5
seconds. Pausing withdraws final consent but retains route progress. A missing
partner, an explicit departure, or two minutes waiting for a clue enables solo
continuation and **A light carried**. Completing solo does not force the other
participant to abandon their own ending.

This computer and Expo tunnel must remain available. Client-reported scans and
arrivals are functional prototype gates, not anti-cheating proofs. There is no
production deployment, push notification, account system, or background tracking.
A production service needs proper deployment, rate limits, and abuse controls.
Saved keepsakes are local to the phone, not account-synced.

## Verification

From app/, run scripts/verify-night-encounter.cjs and scripts/verify-night-sky.cjs
with Node, then TypeScript and Expo lint. The existing portal and shared-signal
checks cover compatibility. Test both phones in **Test the night** by simulating
Cygnus, opting in, collecting the two distinct routes, and sharing at the final
portal. Test incomplete departures and resume as well as the shared ending.
