// Small, durable prototype service mounted on the existing Expo tunnel.
// Stores anonymous capabilities and musical choices, never GPS coordinates.
// Tests inject a temporary file and clock; production records expire in 48 hours.
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");
const LIFETIME = 48 * 60 * 60 * 1000;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message) => {
  throw new Error(message);
};
function createStore(file, clock = Date.now) {
  let state = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { rooms: [] };
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file + ".next", JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(file + ".next", file);
  }
  function view(room, person) {
    const other = room.people.find((p) => p.key !== person.key);
    const both =
      room.people.length === 2 && room.people.every((p) => p.fragment !== null);
    return {
      code: room.code,
      mode: room.mode,
      expiresAt: room.created + LIFETIME,
      role: person.role,
      fragment: person.fragment,
      arrived: person.arrived,
      meet: person.meet,
      again: person.again,
      other: other
        ? { fragment: other.fragment, online: clock() - other.seen < 20000 }
        : null,
      complete: both && person.arrived,
      meeting:
        both &&
        room.people.every(
          (p) =>
            p.arrived &&
            p.meet &&
            clock() - (p.presentAt || 0) < 20000 &&
            clock() - p.seen < 20000,
        ),
      reconnect: both && room.people.every((p) => p.arrived && p.again),
    };
  }
  function request(input) {
    state.rooms = state.rooms.filter(
      (room) => clock() - room.created < LIFETIME,
    );
    if (!input || typeof input !== "object") fail("Invalid request.");
    if (input.action === "start") {
      if (!["walk", "rehearsal"].includes(input.mode))
        fail("Choose walk or rehearsal.");
      // Client-generated request capability makes network retries idempotent.
      if (
        typeof input.token !== "string" ||
        !/^[a-f0-9]{64}$/.test(input.token)
      )
        fail("Invalid session key.");
      const key = digest(input.token);
      const existing = state.rooms.find((room) =>
        room.people.some((p) => p.key === key),
      );
      if (existing)
        return view(
          existing,
          existing.people.find((p) => p.key === key),
        );
      let room;
      if (input.code) {
        room = state.rooms.find((room) => room.code === input.code);
        if (!room || room.people.length !== 1 || room.mode !== input.mode)
          fail("This code is unavailable or belongs to the other mode.");
      } else if (input.mode === "walk") {
        // Only match with a deposited fragment, so an abandoned empty session
        // cannot strand a new visitor. Rehearsals are invite-only.
        room = state.rooms.find(
          (room) =>
            room.people.length === 1 &&
            room.mode === "walk" &&
            room.people[0].fragment !== null,
        );
      }
      if (!room) {
        if (state.rooms.length >= 500)
          fail("The prototype is full. Try later.");
        let code;
        do {
          code = randomBytes(5).toString("hex").toUpperCase();
        } while (state.rooms.some((r) => r.code === code));
        room = { code, mode: input.mode, created: clock(), people: [] };
        state.rooms.push(room);
      }
      const person = {
        key,
        role: room.people[0]?.role === "landon" ? "patina" : "landon",
        fragment: null,
        arrived: false,
        meet: false,
        again: false,
        seen: clock(),
      };
      room.people.push(person);
      save();
      return view(room, person);
    }
    if (typeof input.token !== "string" || !/^[a-f0-9]{64}$/.test(input.token))
      fail("Invalid session key.");
    const key = digest(input.token);
    const room = state.rooms.find((room) =>
      room.people.some((p) => p.key === key),
    );
    if (!room) fail("This shared walk has ended or expired. Start a new one.");
    const person = room.people.find((p) => p.key === key);
    if (input.present === true && person.arrived) person.presentAt = clock();
    else person.presentAt = 0;
    if (input.action === "leave") {
      // Withdraw consent immediately and release the other participant's slot.
      room.people = room.people.filter((p) => p.key !== key);
      for (const remaining of room.people) {
        remaining.arrived = false;
        remaining.meet = false;
        remaining.again = false;
      }
      state.rooms = state.rooms.filter((r) => r.people.length);
      save();
      return { left: true };
    }
    if (input.action === "repeat") {
      if (
        room.people.length !== 2 ||
        !room.people.every((p) => p.arrived && p.again && p.fragment !== null)
      )
        fail("Both people must choose another walk first.");
      for (const participant of room.people) {
        participant.role = participant.role === "landon" ? "patina" : "landon";
        participant.fragment = null;
        participant.arrived = false;
        participant.meet = false;
        participant.again = false;
        participant.presentAt = 0;
      }
    } else if (input.action === "fragment") {
      if (![0, 1, 2].includes(input.fragment))
        fail("Choose one of the three fragments.");
      if (person.fragment !== null && person.fragment !== input.fragment)
        fail("Your fragment has already been deposited.");
      person.fragment = input.fragment;
    } else if (input.action === "arrive") {
      if (person.fragment === null) fail("Contribute your fragment first.");
      person.arrived = true;
    } else if (input.action === "consent") {
      if (!person.arrived) fail("Reach the finale first.");
      if (typeof input.meet !== "boolean" || typeof input.again !== "boolean")
        fail("Invalid choice.");
      person.meet = input.meet;
      person.again = input.again;
    } else if (input.action === "away") {
      person.seen = 0;
      person.meet = false;
      save();
      return view(room, person);
    } else if (input.action !== "state") fail("Unknown action.");
    person.seen = clock();
    save();
    return view(room, person);
  }
  return {
    prune() {
      const before = state.rooms;
      const remaining = before.filter(
        (room) => clock() - room.created < LIFETIME,
      );
      if (remaining.length === before.length) return;
      state.rooms = remaining;
      try {
        save();
      } catch (error) {
        state.rooms = before;
        throw error;
      }
    },
    request(input) {
      const before = JSON.stringify(state);
      try {
        return request(input);
      } catch (error) {
        state = JSON.parse(before);
        throw error;
      }
    },
  };
}
function createMiddleware(file) {
  const store = createStore(file);
  const attempts = new Map();
  const cleanup = setInterval(() => {
    try {
      store.prune();
    } catch {
      console.error("Shared walk expiry cleanup could not save.");
    }
  }, 60000);
  cleanup.unref();
  return (req, res, next) => {
    if (req.url?.split("?")[0] !== "/homage-social/v1") return next();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("{}");
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on("end", () => {
      try {
        const input = JSON.parse(body);
        // Bounded per-capability request rate; no IP/location logs.
        const key =
          typeof input?.token === "string" ? digest(input.token) : "invalid";
        const now = Date.now();
        for (const [id, entry] of attempts)
          if (now - entry.time > 60000) attempts.delete(id);
        const entry = attempts.get(key) || { time: now, count: 0 };
        if (++entry.count > 90 || attempts.size > 2000)
          fail("Please wait a minute before trying again.");
        attempts.set(key, entry);
        res.end(JSON.stringify(store.request(input)));
      } catch (error) {
        res.statusCode = 400;
        // Avoid returning filesystem internals on persistence failures.
        res.end(
          JSON.stringify({
            error: error.code
              ? "Shared walk storage is unavailable. Please retry."
              : error.message,
          }),
        );
      }
    });
  };
}
module.exports = { createStore, createMiddleware };
