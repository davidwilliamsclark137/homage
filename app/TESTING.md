# Downtown walk: first field test

This build is one single-player journey. Two-phone collaboration is planned; two phones can currently run independent walks. No sky scan, rooftop, account, or encounter server is required.

1. Open Homage in Expo Go. Expect one map and three progress circles, not an experiment menu.
2. Deny location once. Expect an explanation and a retry/settings action. Allow precise foreground location. The app must not need camera or motion permissions.
3. Start on the public pedestrian area north of MPAC. Wait for GPS accuracy within 20 m and a fresh reading. At least two readings and three seconds within the 25 m portal radius enable Activate portal.
4. Tap Activate twice quickly. Only portal 1 completes. Close and reopen: progress must resume at portal 2.
5. Follow the clue toward Goodies Texas on N Tennessee Street. The second marker is hidden until within 25 m with good GPS. Walk away before activation: it disappears. Return, settle, and activate.
6. Follow the clue to the Landon Winery sidewalk on N Kentucky Street. Activate portal 3. A keepsake appears and survives relaunch.
7. Background the app while near a portal. On returning it must obtain fresh readings and settle again. Turn off location services or precise permission: activation must stop.
8. In Field notes, inspect GPS accuracy and reading age. Reset requires a separate confirmation and removes only this journey's progress.

Placements are model estimates, not surveyed or field verified. Verify all three sidewalk positions before testing with other people. Do not enter businesses or cross roads to chase a marker; report an inaccessible activation point. Map is north-up, schematic, bundled offline, and has no turn-by-turn navigation.

Record phone/OS, location accuracy, which portal, and what happened. Success means an unfamiliar player understands and completes the walk, can recover from a restart, and never has to guess whether activation succeeded.

## Automated checks

Use Node 24. `npm run check` runs TypeScript, lint, and journey/GPS/progress tests. `npm run check:live` also checks Expo's public tunnel and native bundles. Automated results do not validate phone GPS, sidewalk access, or the fun of the experience.

Run `npm run start:tunnel` on the computer and keep it awake. Expo Go loads a development bundle; this is not an EAS production update.
