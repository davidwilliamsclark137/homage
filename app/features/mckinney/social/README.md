# Shared signal phone prototype

Open Homage in Expo Go on two phones, choose **Try together**, then **Share my
signal** on both. Keep screens open. The first gets amber, the second teal;
after eight seconds of overlapping active presence both reveal **Between us**.
Each phone saves a keepsake locally in AsyncStorage. No signup is required.

At a real portal, **Enter portal → Share a signal here** uses the same interaction
in a room for that portal. The phone must satisfy the existing location gate;
leaving range, stale GPS, losing screen focus, or backgrounding disables presence.
The test room is explicitly separate and bypasses GPS, allowing testing anywhere.

A small in-memory relay is mounted at `/homage-signal` through Metro's
`enhanceMiddleware`. Expo Go uses its existing development host/tunnel, so there
is no second tunnel or production backend deployment. This computer and Expo
must remain running. Restart Expo after modifying relay.cjs or metro.config.js.
Production builds need a separately hosted authenticated presence service.

Only an anonymous device identifier, portal/test room identifier, and session
credentials go to the relay. Other participants never receive these identifiers,
names, or coordinates. GPS stays on the phone. Location is a client-side gate,
not an anti-cheating/security boundary. This is not Bluetooth proximity detection.

The relay pairs two distinct devices, assigns complementary fragments, expires
presence after seven seconds without a heartbeat, and preserves a reveal for
both members even if one leaves before the other's next heartbeat. Departures
before completion reset the pairing. Sessions are transient, bounded to 200,
and discarded on server restart. Saved keepsakes survive app reloads but are not
account-backed. A fragment's color is assigned per encounter in this prototype.

Verify from app/:

    node scripts/verify-shared-signal.cjs
    npx tsc --noEmit
    npm run lint

The test covers solo presence, complementary pairing, both recipients receiving
the reveal, early departure, stale peers, reconnection, isolated portal rooms,
duplicate devices, and malformed/unknown sessions.
