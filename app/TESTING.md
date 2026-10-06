# Homage: test before adding more features

## The workday routine

1. Before leaving, keep this computer powered, awake, and connected to the internet. Leave Expo running. The current prototype depends on this computer.
2. Run `npm run check:live` from `/home/phoenix_wurx/homage/app` (Node 24). This checks code, game rules, the public phone link, the encounter endpoint, and the iPhone bundle. It does not create players in the live matching queue.
3. Read `tmp/checks/latest.md` in the repository root. Each run also keeps a timestamped report. Fix failures before adding another feature; rerun after the fix.
4. If scheduled checks are enabled, they run only while this computer and the Codex app are available. A sleeping/offline host cannot reliably notify you that it is sleeping/offline. This is not an external uptime monitor.
5. On a break, spend five minutes checking one failure scenario on the two phones. Do the complete shared journey before each outdoor trial.

`npm run check` runs only automated checks without requiring a running Expo server. `npm run check:live` adds network/bundle checks. Both return a failing exit code when a check fails. Reports may contain development logs; keep them with the project.

## Two phones at your desk: 10–15 minutes

Use **Test the night** on both phones. Test mode bypasses the real sky and GPS and never pairs with the outdoor mode.

| Test | Steps | Pass condition |
|---|---|---|
| Normal journey | Simulate Cygnus on both, opt in, collect first and second discoveries, share at the final portal on both | One amber route (Landon → Patina), one teal route (Emporium → Fair & Square); both earn Between us |
| No self-pair | Start with only one phone | It waits for another person, rather than creating a fake partner |
| Real cooperation | Collect the first discovery on only one phone | Its second clue stays closed until the other phone makes its first discovery |
| No forced ending | Reach the final portal on both; consent on only one | Neither completes until both consent |
| Temporary interruption | After one discovery, enable airplane mode for 20–30 seconds; turn it off | Same role and progress resume; no accidental completion or new pairing |
| Background and return | At the final portal, consent on one phone, background it, then return | Presence/consent is withdrawn; returning requires sharing again |
| Partner leaves | Explicitly leave on one phone | The other is offered Continue my path solo and can earn A light carried |
| Partner disappears | Stop using one phone for over two minutes | The remaining participant can continue solo, without losing discoveries |
| Persistence | Complete, fully close Expo Go, then reopen the same app | The keepsake remains; active encounters resume within their two-hour lifetime |
| Separate networks | Put one phone on cellular and the other on Wi-Fi | Both connect through the public Expo tunnel and complete the journey |

Optional third-phone check: a third person scanning Cygnus waits for their own pair and cannot join an existing two-person event. Automated tests cover constellation and test/field separation too.

## One outdoor technical trial: 20–30 minutes

Do this before inviting unfamiliar participants. Use **Find the same sky**, after dark, in downtown McKinney.

| Test | Pass condition |
|---|---|
| Permission denied, then granted | Camera/location/motion denial produces a useful message; retry succeeds without reinstalling |
| Daylight or unsupported sky | The app does not offer a successful real scan |
| Find the constellation | The calculated outline and bright anchor are plausibly aligned with the actual sky on both phones |
| Hold interrupted | Moving off the target before three seconds resets the hold; returning starts a new hold |
| Background during scan | No constellation is captured while the phone is backgrounded |
| Same constellation | Both scan the same pattern and opt in within a minute; they receive different roles in one encounter |
| Real arrivals | A portal cannot be collected from far away; it becomes available at the intended outdoor spot with good GPS |
| Hidden portals | Goodies, Fair & Square, and TUPPS appear nearby and disappear again after leaving the radius |
| MPAC meeting point | Both phones can unlock the north-side gathering point from a comfortable public pedestrian location |
| Final sharing | Completion requires both phones at the final portal with fresh location and both people choosing to share |

Portal locations are model estimates. If a marker requires standing in a road, entering a closed venue, or hovering at an inaccessible spot, mark that test failed and adjust it before inviting anyone. Do not widen all location gates to conceal one misplaced portal. Sky alignment uses phone sensors, not camera recognition; cloud cover and compass interference can prevent a useful test.

## Test the social idea separately

Once the technical trial passes, have two willing testers walk the separate routes without coaching. Tell them they may stop whenever they like. Observe:

- Can they explain what the other person's contribution changed?
- Do they understand where to go without repeated help?
- Does waiting feel interesting or frustrating?
- At the final portal, do they notice each other and feel comfortable choosing whether to interact?

Ask each person afterward: “Where were you confused?”, “When did it feel like another real person was involved?”, and “Would you do this again?” Working software alone does not validate the social experience.

## Decision to move forward

Proceed with another feature after:

- The automated/live report is green.
- The two-phone normal journey passes twice, including one test across Wi-Fi/cellular.
- Interruption, departure, solo completion, and saved-keepsake tests pass.
- At least one outdoor trial passes for sky alignment, all four route stops, and MPAC.
- A short uncoached test shows that people understand the shared discovery.

Treat incorrect pairing, unintended completion, lost progress, unreliable arrival gates, or inaccessible destinations as blockers. Cosmetic polish can wait. A development prototype passing this checklist is still not a production/public-launch readiness review.

## Small issue log

Copy one line per finding into `tmp/checks/field-notes.md`:

`Date/time | phone/OS | test or field | portal/stage | action | expected | actual | repeatable? | screenshot filename`

Record both phones' observations for a pairing issue. Avoid including session credentials or another person's private details. Keep one short list of blockers so changes can be retested against the same steps.

## Sky scanning lab (before another outdoor encounter)

Reload Expo Go and choose **Sky scanning lab** from Home. Test on each phone
independently after dark; downtown is not required for this screen. Select the
same named star, check that its marker agrees with the real sky, and acquire it
three times. A capture must finish with **Direction acquired** and a diagnostic
summary. Use **Try another scan** to repeat or **Share test result** to keep the
summary. No phone pairing or encounter endpoint is involved.

Check clockwise heading, increasing elevation while tilting the rear camera up,
a small wobble pausing progress, looking away resetting progress, and leaving the
screen/backgrounding stopping sensors. A failed attempt should be reported with
the visible status and live diagnostics. Do not count a direction-only capture
as proof of star recognition or calibrated camera alignment.

Reusable engine API and coordinate conventions: `sky/engine/README.md`.
