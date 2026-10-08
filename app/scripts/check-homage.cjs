#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const app = path.resolve(__dirname, "..");
const live = process.argv.includes("--live");
const started = new Date();
const results = [];
const dir = path.resolve(app, "../tmp/checks");
fs.mkdirSync(dir, { recursive: true });
async function check(name, run) {
  const time = Date.now();
  try {
    const detail = await run();
    results.push({
      name,
      status: "PASS",
      seconds: ((Date.now() - time) / 1000).toFixed(1),
      detail,
    });
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      seconds: ((Date.now() - time) / 1000).toFixed(1),
      detail: error.message,
    });
  }
  console.log(results.at(-1).status + " · " + name);
}
function command(args) {
  const r = spawnSync(process.execPath, args, {
    cwd: app,
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, CI: "1" },
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = ((r.stdout || "") + "\n" + (r.stderr || "")).trim();
  if (r.error || r.status !== 0)
    throw Error(
      (r.error?.message || "Exit " + r.status) + "\n" + output.slice(-8000),
    );
  return output.slice(-8000) || "Passed.";
}
async function request(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw Error("HTTP " + r.status + " from " + new URL(url).pathname);
  return r;
}
(async () => {
  const checks = [
    ["TypeScript", ["node_modules/typescript/bin/tsc", "--noEmit"]],
    ["Expo lint", ["node_modules/expo/bin/cli", "lint"]],
    ["Location and hidden portals", ["scripts/verify-rooftop.cjs"]],
    ["Map data and bundled assets", ["scripts/verify-portal-map.cjs"]],
  ];
  for (const [name, args] of checks) await check(name, () => command(args));
  if (live) {
    let host;
    await check("Local Expo manifest", async () => {
      const m = await (
        await request("http://127.0.0.1:8084/", {
          headers: { "expo-platform": "ios" },
        })
      ).json();
      host = m.extra?.expoClient?.hostUri;
      if (typeof host !== "string" || !/^[a-z0-9-]+\.exp\.direct$/.test(host))
        throw Error("No supported public Expo tunnel in manifest.");
      return "Expo Go: exp://" + host;
    });
    await check("Public Expo phone link", async () => {
      if (!host) throw Error("Local manifest did not provide a public tunnel.");
      const m = await (
        await request("https://" + host + "/", {
          headers: { "expo-platform": "ios" },
        })
      ).json();
      if (m.extra?.expoClient?.hostUri !== host)
        throw Error("Public manifest does not match this Expo server.");
      return "Public iPhone manifest responded.";
    });
    for (const platform of ["ios", "android"])
      await check(platform + " development bundle", async () => {
        const r = await request(
          "http://127.0.0.1:8084/node_modules/expo-router/entry.bundle?platform=" +
            platform +
            "&dev=true&minify=false",
        );
        const code = await r.text();
        if (!code.includes("McKinney portal map") || code.length < 100000)
          throw Error("Expected app code missing from bundle.");
        return (
          platform +
          " bundle built (" +
          Math.round(code.length / 1024) +
          " KiB). Hardware behavior is not tested by this check."
        );
      });
  }
  const failed = results.filter((r) => r.status === "FAIL").length;
  const lines = [
    "# Homage test report",
    "",
    started.toISOString(),
    "",
    "Result: " +
      (failed ? "FAIL (" + failed + " checks)" : "PASS") +
      " · " +
      (live ? "automated + live availability" : "automated only"),
    "",
    "| Check | Result | Seconds |",
    "|---|---|---|",
    ...results.map(
      (r) => "| " + r.name + " | " + r.status + " | " + r.seconds + " |",
    ),
    "",
    "Real 3D rendering, outdoor GPS, walking access, and portal placements require the manual checklist in TESTING.md. A PASS here is not approval for a public launch.",
    "",
    ...results.flatMap((r) => [
      "## " + r.name,
      "",
      "```text",
      r.detail.replace(/```/g, "'''"),
      "```",
      "",
    ]),
  ];
  const report = lines.join("\n");
  const file = path.join(
    dir,
    started.toISOString().replace(/[:.]/g, "-") + ".md",
  );
  fs.writeFileSync(file, report);
  fs.writeFileSync(path.join(dir, "latest.md"), report);
  console.log("\nReport: " + file);
  console.log("Latest: " + path.join(dir, "latest.md"));
  process.exitCode = failed ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
