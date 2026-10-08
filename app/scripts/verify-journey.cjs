const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../journey/engine.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const m = new Module(file, module);
m.filename = file;
m.paths = module.paths;
m._compile(compiled, file);
const e = m.exports;
const now = Date.now();
const fix = (i = 0, t = now) => ({ ...e.PORTALS[i], accuracy: 5, timestamp: t });
let p = e.emptyProgress();
assert.equal(
  e.activate(p, e.PORTALS[1].id, fix(1), { ready: true }, now),
  p,
  'cannot skip portals',
);
assert.equal(
  e.activate(p, e.PORTALS[0].id, fix(), null, now),
  p,
  'arrival must settle',
);
assert.equal(e.nearby({ ...fix(), accuracy: 21 }, 0, now), false);
assert.equal(e.nearby({ ...fix(), accuracy: NaN }, 0, now), false);
assert.equal(e.nearby({ ...fix(), latitude: Infinity }, 0, now), false);
assert.equal(e.nearby(fix(0, now - 15001), 0, now), false);
assert.equal(e.nearby(fix(0, now + 1), 0, now), false);
assert.equal(e.nearby({ ...fix(), latitude: 0 }, 0, now), false);
let a = e.updateArrival(null, fix(), 0, now);
assert.equal(
  e.updateArrival(a, fix(), 0, now + 3000).ready,
  false,
  'one reading cannot settle',
);
a = e.updateArrival(a, fix(0, now + 3000), 0, now + 3000);
assert.equal(a.ready, true);
assert.equal(e.updateArrival(a, null, 0, now + 3000), null, 'lost GPS resets arrival');
assert.equal(
  e.updateArrival(a, fix(1), 0, now + 3000),
  null,
  'walking away resets arrival',
);
for (let i = 0; i < 3; i++) {
  const f = fix(i, now + 3000);
  const first = e.updateArrival(null, f, i, now + 3000);
  const latest = fix(i, now + 6000);
  const ready = e.updateArrival(first, latest, i, now + 6000);
  p = e.activate(p, e.PORTALS[i].id, latest, ready, now + 6000);
  assert.equal(p.completed.length, i + 1);
  assert.deepEqual(e.restoreProgress(JSON.stringify(p)), p, 'resume exact progress');
  assert.equal(
    e.activate(p, e.PORTALS[i].id, latest, ready, now + 6000),
    p,
    'repeat tap is idempotent',
  );
}
assert.ok(p.completedAt);
assert.throws(() => e.restoreProgress('{broken'));
assert.throws(() => e.restoreProgress(JSON.stringify({ ...p, completed: ['wrong'] })));
assert.throws(() => e.restoreProgress(JSON.stringify({ ...p, completedAt: null })));
assert.equal(e.PORTALS.filter((p) => p.hidden).length, 1);
console.log(
  'Passed: ordered journey, hidden proximity, invalid/stale GPS, arrival settling, duplicate taps, completion, saved-progress validation.',
);
