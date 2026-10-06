const { randomBytes } = require('node:crypto');
const story = require('./story.json');
const QUEUE_MS = 15 * 60 * 1000;
const LIFE_MS = 2 * 60 * 60 * 1000;
const SOLO_MS = 2 * 60 * 1000;
const PRESENCE_MS = 12000;
function createEncounterRelay({ clock = Date.now, initial = [], save = () => {} } = {}) {
  const people = new Map(initial.map(p => [p.key, p]));
  function peer(p) { return people.get(p.peer); }
  function canSolo(p) {
    const q = peer(p);
    return (!!p.waitingSince && clock() - p.waitingSince >= SOLO_MS) || !!p.solo || !!q?.left || !!q?.solo || clock() - (q ? q.seen : p.joined) >= SOLO_MS;
  }
  function snapshot(p) {
    const q = peer(p);
    const peerOnline = !!q && !q.left && !q.solo && !q.paused && clock() - q.seen <= PRESENCE_MS;
    return { eventId: p.eventId, constellation: p.constellation, mode: p.mode, role: p.role,
      progress: p.progress, peerProgress: q?.progress ?? 0,
      phase: p.left ? 'left' : p.complete ? 'complete' : p.solo ? 'solo' : p.peer ? 'paired' : 'waiting',
      peerOnline, peerLeft: !!q?.left || !!q?.solo, canSolo: canSolo(p),
      soloWaitMs: Math.max(0, SOLO_MS - (clock() - (q ? q.seen : p.joined))),
      canCollect: p.progress < 2 && (p.progress === 0 ? (!!p.peer || !!p.solo) : (!!p.solo || (q?.progress ?? 0) >= 1)),
      consent: !!p.consent, peerAtFinal: peerOnline && !!q?.atFinal,
      ending: p.complete ? p.ending : null, expiresAt: p.joined + LIFE_MS };
  }
  function finish(p) {
    const q = peer(p);
    if (p.progress !== 2 || !p.atFinal || !p.consent || p.complete) return;
    if (p.solo) { p.complete = true; p.ending = 'solo'; return; }
    if (q && !q.left && !q.solo && !q.paused && q.progress === 2 && q.atFinal && q.consent && clock() - q.seen <= PRESENCE_MS) {
      p.complete = q.complete = true; p.ending = q.ending = 'shared';
    }
  }
  function act(body) {
    const now = clock();
    for (const [key,p] of people) if (now - p.joined > LIFE_MS) people.delete(key);
    const fail = (status, error) => ({ status, body: { error } });
    if (typeof body.key !== 'string' || !/^[a-f0-9]{48}$/.test(body.key)) return fail(400, 'Invalid encounter credential.');
    let p = people.get(body.key);
    if (body.action === 'join') {
      if (p) return { status: 200, body: snapshot(p) };
      if (!['test','field'].includes(body.mode) || !story.constellations.includes(body.constellation)) return fail(400, 'Choose a supported constellation.');
      if (!Number.isFinite(body.scannedAt) || now - body.scannedAt < -5000 || now - body.scannedAt > 60000) return fail(400, 'Scan the constellation again to start.');
      if (people.size >= 200) return fail(503, 'The night is busy. Try again shortly.');
      p = { key: body.key, mode: body.mode, constellation: body.constellation, joined: now, seen: now, progress: 0, role: 'amber', peer: null, eventId: randomBytes(10).toString('hex') };
      const q = [...people.values()].find(q => !q.peer && !q.left && !q.solo && !q.paused && !q.complete && q.mode === p.mode && q.constellation === p.constellation && now - q.joined <= QUEUE_MS && now - q.seen <= PRESENCE_MS);
      if (q) { p.role = 'teal'; p.peer = q.key; q.peer = p.key; p.eventId = q.eventId; }
      people.set(p.key,p);
    } else {
      if (!p) return fail(410, 'This encounter expired. Your saved keepsakes remain on this phone.');
      if (body.action === 'read') return { status: 200, body: snapshot(p) };
      if (p.left) return fail(410, 'You left this encounter. Start a new scan when ready.');
      if (!['pulse','collect','solo','consent','leave','pause'].includes(body.action)) return fail(400, 'Unknown encounter action.');
      if (body.action === 'leave') { p.left = true; p.atFinal = false; p.consent = false; }
      if (body.action === 'pause') { p.atFinal = false; p.consent = false; p.seen = now; p.paused = true; }
      if (body.action === 'solo') {
        if (!canSolo(p)) return fail(409, 'Your partner is still connected. Solo continuation becomes available after two minutes apart.');
        if (!p.complete) { p.solo = true; p.consent = false; }
      }
      if (body.action === 'collect') {
        if (body.step < p.progress && Number.isInteger(body.step) && body.step >= 0) return { status: 200, body: snapshot(p) };
        if (body.step !== p.progress || !snapshot(p).canCollect) return fail(409, 'This clue is not ready yet.');
        const expected = story.routes[p.role][p.progress]?.portalId;
        if (body.portalId !== expected || body.arrived !== true) return fail(409, 'Reach your current portal first.');
        p.progress++; p.waitingSince = now; p.atFinal = false; p.consent = false;
      }
      if (body.action === 'pulse' || body.action === 'consent') {
        p.atFinal = p.progress === 2 && body.atFinal === true;
        if (!p.atFinal) p.consent = false;
        if (body.action === 'consent') {
          if (!p.atFinal) return fail(409, 'Reach the final portal before sharing.');
          p.consent = true;
        }
      }
      if (body.action !== 'pause' && body.action !== 'leave') { p.seen = now; p.paused = false; }
      finish(p);
    }
    save([...people.values()]);
    return { status: 200, body: snapshot(p) };
  }
  return { act };
}
module.exports = { createEncounterRelay, QUEUE_MS, LIFE_MS, SOLO_MS, PRESENCE_MS };
