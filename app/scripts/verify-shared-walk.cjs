// Exercise two independent identities against an isolated, disposable store.
// Never sends participants or contributions to the live service.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createStore } = require("../server/shared-walk.cjs");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "homage-shared-"));
let now = 1800000000000;
const file = path.join(directory, "state.json");
let store = createStore(file, () => now);
const tokens = ["a", "b", "c", "d", "e", "f"].map((letter) =>
  letter.repeat(64),
);
const send = (index, action, data = {}) =>
  store.request({ token: tokens[index], action, ...data });
try {
  const first = send(0, "start", { mode: "rehearsal" });
  assert.equal(first.role, "landon");
  assert.deepEqual(
    send(0, "start", { mode: "rehearsal" }),
    first,
    "start retry must not allocate twice",
  );
  assert.throws(() => send(1, "start", { mode: "walk", code: first.code }));
  const second = send(1, "start", { mode: "rehearsal", code: first.code });
  assert.equal(second.role, "patina");
  assert.throws(() =>
    send(2, "start", { mode: "rehearsal", code: first.code }),
  );
  assert.throws(() => send(2, "state"), /expired/);
  assert.throws(() => send(0, "arrive"), /first/);
  assert.throws(() => send(0, "fragment", { fragment: 8 }));
  send(0, "fragment", { fragment: 0 });
  send(0, "fragment", { fragment: 0 });
  assert.throws(() => send(0, "fragment", { fragment: 1 }), /already/);
  send(1, "fragment", { fragment: 2 });
  assert.equal(send(0, "state").complete, false, "must reach finale");
  send(0, "arrive");
  assert.equal(
    send(0, "state").complete,
    true,
    "asynchronous finale is possible",
  );
  send(1, "arrive");
  send(0, "consent", { meet: true, again: true, present: true });
  assert.equal(
    send(0, "state", { present: true }).meeting,
    false,
    "one consent is insufficient",
  );
  send(1, "consent", { meet: true, again: false, present: true });
  assert.equal(send(0, "state", { present: true }).meeting, true);
  now += 21000;
  assert.equal(
    send(0, "state", { present: true }).meeting,
    false,
    "stale partner is not a meeting",
  );
  send(1, "consent", { meet: false, again: true, present: true });
  assert.equal(
    send(0, "state", { present: true }).meeting,
    false,
    "withdrawal takes effect",
  );
  assert.equal(send(0, "state").reconnect, true);
  send(0, "repeat");
  assert.equal(send(0, "state").role, "patina");
  assert.equal(send(0, "state").fragment, null);
  assert.equal(send(0, "state").meet, false);
  assert.throws(() => send(1, "repeat"));
  // Service restart restores capabilities and progress.
  store = createStore(file, () => now);
  assert.equal(send(0, "state").code, first.code);
  send(1, "leave");
  assert.equal(send(0, "state").other, null);
  assert.equal(
    send(2, "start", { mode: "rehearsal", code: first.code }).role,
    "landon",
    "replacement complements remaining role",
  );
  const outdoor = send(3, "start", { mode: "walk" });
  send(3, "fragment", { fragment: 1 });
  send(3, "away");
  const later = send(4, "start", { mode: "walk" });
  assert.equal(later.code, outdoor.code);
  assert.equal(later.other.online, false);
  assert.equal(later.other.fragment, 1);
  assert.equal(later.other.key, undefined, "never expose peer capability");
  assert.equal(later.other.latitude, undefined);
  assert.equal(
    send(5, "start", { mode: "rehearsal" }).other,
    null,
    "rehearsal never enters public walk pool",
  );
  const ts = require("typescript");
  const music = { exports: {} };
  new Function(
    "exports",
    ts.transpileModule(
      fs.readFileSync(
        path.join(__dirname, "../features/shared/music.ts"),
        "utf8",
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
  )(music.exports);
  assert.deepEqual(
    music.exports.compositionNotes("landon", 0, 1),
    music.exports.compositionNotes("patina", 1, 0),
    "both phones hear the same composition",
  );
  assert.notDeepEqual(
    music.exports.compositionNotes("landon", 0, 1),
    music.exports.compositionNotes("landon", 2, 1),
    "a contribution changes the finale",
  );
  now += 48 * 60 * 60 * 1000;
  store.prune();
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).rooms, []);
  assert.throws(() => send(0, "state"), /expired/);
  console.log(
    "Shared walk passed: distinct phones, idempotent retries, capacity, expiry, restart persistence, asynchronous matching, mode isolation, arrival gates, consent and withdrawal, repeat walk.",
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
