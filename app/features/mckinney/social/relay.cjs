// Development-only relay, served through the same Expo tunnel as the app.
const { randomBytes } = require('node:crypto');
const portals = require('../portals/mapPortals.json');
const TTL = 7000;
const REVEAL_MS = 8000;
function createRelay(clock = Date.now) {
  const sessions = new Map();
  const rooms = new Set(['test:shared', ...portals.map(p => p.id)]);
  function detach(s) {
    const peer = sessions.get(s.peer);
    if (peer) { peer.peer = null; peer.started = null; }
    s.peer = null; s.started = null;
  }
  function prune() {
    for (const [token, s] of sessions) {
      if (clock() - s.seen > TTL) { detach(s); sessions.delete(token); }
    }
  }
  function pair(s) {
    if (s.peer || s.earned) return;
    const peer = [...sessions.values()].find(p => p !== s && p.room === s.room && !p.peer && !p.earned);
    if (!peer) return;
    s.fragment = peer.fragment === 'amber' ? 'teal' : 'amber';
    s.peer = peer.token; peer.peer = s.token;
    s.started = peer.started = clock();
  }
  function snapshot(s) {
    const peer = sessions.get(s.peer);
    if (peer && clock() - s.started >= REVEAL_MS) s.earned = peer.earned = true;
    return { token: s.token, fragment: s.fragment, phase: s.earned ? 'revealed' : peer ? 'resonating' : 'waiting',
      remainingMs: peer ? Math.max(0, REVEAL_MS - (clock() - s.started)) : REVEAL_MS };
  }
  function act(body) {
    prune();
    if (body.action === 'join') {
      if (typeof body.device !== 'string' || body.device.length < 10 || body.device.length > 100) return { status: 400, body: { error: 'Invalid device' } };
      const existing = [...sessions.values()].find(s => s.device === body.device);
      if (existing && existing.room === body.room) { existing.seen = clock(); return { status: 200, body: snapshot(existing) }; }
      if (existing) { detach(existing); sessions.delete(existing.token); }
      if (!rooms.has(body.room)) return { status: 400, body: { error: 'Unknown portal' } };
      if (sessions.size >= 200) return { status: 503, body: { error: 'Signal is busy. Try again shortly.' } };
      const token = randomBytes(24).toString('hex');
      const s = { token, device: body.device, room: body.room, fragment: 'amber', peer: null, started: null, seen: clock(), earned: false };
      sessions.set(token, s); pair(s);
      return { status: 200, body: snapshot(s) };
    }
    const s = sessions.get(body.token);
    if (!s) return { status: 410, body: { error: 'Connection expired. Join again.' } };
    if (body.action === 'leave') { detach(s); sessions.delete(s.token); return { status: 200, body: { ok: true } }; }
    if (body.action !== 'pulse') return { status: 400, body: { error: 'Unknown action' } };
    s.seen = clock(); pair(s);
    return { status: 200, body: snapshot(s) };
  }
  return { act };
}
function createMiddleware() {
  const relay = createRelay();
  const fs = require('node:fs');
  const path = require('node:path');
  const { createEncounterRelay } = require('../encounter/relay.cjs');
  const file = path.resolve(__dirname, '../../../.expo/night-encounters.json');
  let initial = [];
  try { initial = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* First run. */ }
  const encounter = createEncounterRelay({ initial, save: data => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
  } });
  return (req, res, next) => {
    const route = req.url?.split('?')[0];
    if (!['/homage-signal', '/homage-encounter'].includes(route)) return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Use POST' })); return; }
    let input = ''; let oversized = false;
    req.on('data', chunk => { if (!oversized) { input += chunk; if (input.length > 2048) { oversized = true; res.statusCode = 413; res.end('{}'); } } });
    req.on('end', () => {
      if (oversized) return;
      try {
        const body = JSON.parse(input);
        if (!body || typeof body !== 'object') throw Error('Invalid request');
        const result = (route === '/homage-encounter' ? encounter : relay).act(body); res.statusCode = result.status; res.end(JSON.stringify(result.body));
      } catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid request' })); }
    });
  };
}
module.exports = { createRelay, createMiddleware, TTL, REVEAL_MS };
