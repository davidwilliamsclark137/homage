// Verify activity coverage and puzzle rules without GPS or live participants.
// Reads source and audio assets; all compilation stays in memory.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");
const app = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(app, "features/mckinney/activities/activities.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const values = {};
new Function("exports", compiled)(values);
const portals = require("../features/mckinney/portals/mapPortals.json");
assert.deepEqual(
  Object.keys(values.ACTIVITIES).sort(),
  portals.map((p) => p.id).sort(),
);
assert.equal(
  new Set(Object.values(values.ACTIVITIES).map((a) => a.kind)).size,
  8,
);
assert.equal(values.SWEET_SEQUENCE.reduce(values.memoryStep, 0), 3);
assert.equal(values.memoryStep(1, 1), 0);
assert(!values.fitsSlice(1));
assert(values.fitsSlice(4));
assert(!values.fitsWeave(0, 0));
assert(!values.fitsWeave(1, 2));
assert(values.fitsWeave(1, 1));
for (const name of ["low", "middle", "high"]) {
  const wav = fs.readFileSync(path.join(app, `assets/audio/note-${name}.wav`));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 22050);
  assert(wav.length > 50000);
}
console.log(
  "Eight distinct activities; sequence, slice, weave and bundled note checks passed.",
);

// Reproduce the iOS cleanup order: released player, live peer, released peer.
const pauseSource = fs.readFileSync(
  path.join(app, "features/mckinney/audio/safePause.ts"),
  "utf8",
);
const pauseExports = {};
new Function(
  "exports",
  ts.transpileModule(pauseSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(pauseExports);
let peerPaused = 0;
const released = {
  pause() {
    throw new Error("NativeSharedObjectNotFoundException");
  },
};
assert.doesNotThrow(() =>
  pauseExports.pausePlayers([
    released,
    {
      pause() {
        peerPaused++;
      },
    },
    released,
  ]),
);
assert.equal(peerPaused, 1);
console.log(
  "Released-player cleanup regression passed; remaining players still pause.",
);

// Exercise the actual rooftop handlers with virtual time and native-like players.
const componentSource = fs.readFileSync(
  path.join(app, "features/mckinney/activities/PortalActivity.tsx"),
  "utf8",
);
const componentCode = ts.transpileModule(componentSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
async function verifyHold(interrupt) {
  let clock = 0,
    nextTimer = 0;
  const scheduled = new Map();
  const state = [];
  const cleanups = [];
  const players = [];
  const jsx = (type, props) => ({ type, props });
  const native = {
    AppState: { addEventListener: () => ({ remove() {} }) },
    StyleSheet: { create: (value) => value },
  };
  function mockRequire(name) {
    if (name === "react")
      return {
        useRef: (current) => ({ current }),
        useState: (initial) => {
          const index = state.length;
          state.push(initial);
          return [
            initial,
            (value) => {
              state[index] = value;
            },
          ];
        },
        useEffect: (effect) => {
          cleanups.push(effect());
        },
      };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react-native") return native;
    if (name === "expo-audio")
      return {
        useAudioPlayer: () => {
          const player = {
            isLoaded: true,
            volume: 0,
            plays: 0,
            released: false,
            async seekTo() {},
            play() {
              this.plays++;
            },
            pause() {
              if (this.released)
                throw Error("NativeSharedObjectNotFoundException");
            },
          };
          players.push(player);
          return player;
        },
      };
    if (name === "./activities") return values;
    if (name === "../audio/safePause") return pauseExports;
    if (name.endsWith(".wav")) return 1;
    throw Error("Unexpected import " + name);
  }
  const component = {};
  new Function(
    "require",
    "exports",
    "setTimeout",
    "clearTimeout",
    componentCode,
  )(
    mockRequire,
    component,
    (action, delay) => {
      const id = ++nextTimer;
      scheduled.set(id, { at: clock + delay, action });
      return id;
    },
    (id) => scheduled.delete(id),
  );
  const tree = component.PortalActivity({ portal: portals[0], preview: true });
  function find(node) {
    if (!node || typeof node !== "object") return null;
    if (node.props?.accessibilityLabel === "Hold for three seconds")
      return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  }
  const hold = find(tree);
  assert(hold);
  async function advance(ms) {
    const end = clock + ms;
    while (true) {
      const next = [...scheduled]
        .filter(([, v]) => v.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      clock = next[1].at;
      scheduled.delete(next[0]);
      next[1].action();
      await Promise.resolve();
    }
    clock = end;
    await Promise.resolve();
  }
  hold.props.onPressIn();
  await advance(1500);
  assert.equal(state[0], false);
  if (interrupt) hold.props.onPressOut();
  await advance(1500);
  assert.equal(state[0], !interrupt);
  assert(players[0].plays > 0);
  if (!interrupt) {
    assert(players[1].plays > 0);
    assert(players[2].plays > 0);
  }
  // Match Expo's observed unmount order: native release precedes our cleanup.
  players.forEach((player) => {
    player.released = true;
  });
  cleanups.forEach((cleanup) => assert.doesNotThrow(cleanup));
  assert.equal(scheduled.size, 0);
}
(async () => {
  await verifyHold(false);
  await verifyHold(true);
  console.log(
    "Rooftop hold: sounds, completion, early release and unmount passed.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Check that story choices cannot skip activities and every branch reaches MPAC.
const graphSource = fs.readFileSync(
  path.join(app, "features/mckinney/journey/graph.ts"),
  "utf8",
);
const graph = {};
new Function(
  "exports",
  ts.transpileModule(graphSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(graph);
let journey = graph.beginJourney();
assert.equal(graph.currentStop(journey), "landon-storefront");
assert.deepEqual(graph.nextStops(journey), []);
assert.strictEqual(graph.chooseStop(journey, "mpac-meeting"), journey);
assert.strictEqual(graph.completeStop(journey, "mpac-meeting"), journey);
journey = graph.completeStop(journey, "landon-storefront");
assert.strictEqual(graph.completeStop(journey, "landon-storefront"), journey);
assert.deepEqual(graph.nextStops(journey), [
  "emporium-storefront",
  "patina-storefront",
]);
assert.strictEqual(graph.chooseStop(journey, "tupps-hidden"), journey);
const ids = new Set(portals.map((portal) => portal.id));
function visit(id, path = []) {
  assert(ids.has(id));
  assert(!path.includes(id), "Unexpected story cycle");
  const edges = graph.CONNECTIONS[id];
  assert(Array.isArray(edges));
  if (!edges.length) assert.equal(id, "mpac-meeting");
  edges.forEach((next) => visit(next, [...path, id]));
}
Object.keys(graph.CONNECTIONS).forEach((id) => visit(id));
for (const route of [
  ["emporium-storefront", "fair-square-hidden", "mpac-meeting"],
  [
    "patina-storefront",
    "goodies-hidden",
    "fair-square-hidden",
    "tupps-hidden",
    "mpac-meeting",
  ],
]) {
  let run = graph.completeStop(graph.beginJourney(), "landon-storefront");
  for (const id of route) {
    run = graph.chooseStop(run, id);
    assert.equal(graph.currentStop(run), id);
    assert(!graph.journeyFinished(run));
    run = graph.completeStop(run, id);
  }
  assert(graph.journeyFinished(run));
  assert.deepEqual(graph.nextStops(run), []);
}
console.log(
  "Journey branches, completion gates, valid destinations and finale reachability passed.",
);
