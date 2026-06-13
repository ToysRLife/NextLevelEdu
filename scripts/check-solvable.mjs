// Build-time solvability guard.
//
// Several games have a fixed table of ROUNDS and a target the player must hit
// using a bounded control (a slider distance, a ramp angle, thrust/mass…). It's
// easy to ship a round whose only solution sits OUTSIDE the playable range —
// making it impossible to win (this has bitten us in friction, levers, …).
//
// This script reads each such game's ROUNDS straight from its source (so the
// data never drifts from the real game) and checks every round has at least one
// reachable winning input. A failure exits non-zero, so `npm run build` — and
// therefore CI / the deploy — fails loudly instead of shipping a stuck level.

import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const failures = [];
const ok = [];

function pass(game, detail) {
  ok.push(`✓ ${game}: ${detail}`);
}
function fail(game, detail) {
  failures.push(`✗ ${game}: ${detail}`);
}

// --- levers (Balance Master): balance distance = loadW*loadD / effortW must be
//     a whole number within the beam (1..7). -----------------------------------
try {
  const n = failures.length;
  const src = read("src/games/levers/index.ts");
  const rounds = [...src.matchAll(/loadWeight:\s*(\d+),\s*loadDist:\s*(\d+),\s*effortWeight:\s*(\d+)/g)].map(
    (m) => ({ lw: +m[1], ld: +m[2], ew: +m[3] }),
  );
  if (!rounds.length) fail("levers", "could not parse ROUNDS");
  rounds.forEach((r, i) => {
    const d = (r.lw * r.ld) / r.ew;
    if (!Number.isInteger(d) || d < 1 || d > 7)
      fail("levers", `round ${i + 1} needs distance ${d} (must be a whole number 1–7)`);
  });
  if (rounds.length && failures.length === n) pass("levers", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("levers", String(e));
}

// --- ramp (Easy Does It): need ∃ integer angle 12..55 with weight*sin(angle) ≤ 50.
try {
  const n = failures.length;
  const src = read("src/games/ramp/index.ts");
  const maxForce = +(src.match(/MAX_FORCE\s*=\s*(\d+)/)?.[1] ?? 50);
  const rounds = [...src.matchAll(/weight:\s*(\d+),\s*height:\s*(\d+)/g)].map((m) => ({ w: +m[1], h: +m[2] }));
  if (!rounds.length) fail("ramp", "could not parse ROUNDS");
  rounds.forEach((r, i) => {
    let solvable = false;
    for (let a = 12; a <= 55; a++) if (r.w * Math.sin((a * Math.PI) / 180) <= maxForce) solvable = true;
    if (!solvable) fail("ramp", `round ${i + 1} (weight ${r.w}) can't get force ≤ ${maxForce} at any angle 12–55°`);
  });
  if (rounds.length && failures.length === n) pass("ramp", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("ramp", String(e));
}

// --- rocketlab (Rocket Lab): need ∃ thrust∈[100,1500]step50, mass∈[50,400]step10
//     with |F/m * burn − targetV| ≤ tol (use the tightest 'master' tolerance). --
try {
  const n = failures.length;
  const src = read("src/games/rocketlab/index.ts");
  const rounds = [...src.matchAll(/targetV:\s*(\d+),\s*burn:\s*(\d+)/g)].map((m) => ({ v: +m[1], burn: +m[2] }));
  const tol = 1.5; // byTier master
  if (!rounds.length) fail("rocketlab", "could not parse ROUNDS");
  rounds.forEach((r, i) => {
    let solvable = false;
    for (let F = 100; F <= 1500 && !solvable; F += 50)
      for (let m = 50; m <= 400; m += 10) if (Math.abs((F / m) * r.burn - r.v) <= tol) { solvable = true; break; }
    if (!solvable) fail("rocketlab", `round ${i + 1} (target ${r.v} m/s in ${r.burn}s) unreachable with the sliders`);
  });
  if (rounds.length && failures.length === n) pass("rocketlab", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("rocketlab", String(e));
}

// --- coaster (Coaster Architect): launch height (slider max) must exceed the
//     tallest hill peak of every round. ------------------------------------------
try {
  const n = failures.length;
  const src = read("src/games/coaster/index.ts");
  const maxLaunch = +(src.match(/min:\s*10,\s*max:\s*(\d+)/)?.[1] ?? 100);
  const rounds = [...src.matchAll(/hills:\s*\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/peak:\s*(\d+)/g)].map((p) => +p[1]));
  if (!rounds.length) fail("coaster", "could not parse ROUNDS");
  rounds.forEach((peaks, i) => {
    const tallest = Math.max(...peaks);
    if (maxLaunch <= tallest) fail("coaster", `round ${i + 1} tallest hill ${tallest}m ≥ max launch ${maxLaunch}m`);
  });
  if (rounds.length && failures.length === n) pass("coaster", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("coaster", String(e));
}

// --- crashtest: ∃ massA∈[2,10]step1, speedA∈[2,10]step0.5 with combined speed
//     (mA·vA)/(mA+mB) within tol of targetV. -----------------------------------
try {
  const n = failures.length;
  const src = read("src/games/crashtest/index.ts");
  const rounds = [...src.matchAll(/massB:\s*(\d+),\s*targetV:\s*(\d+)/g)].map((m) => ({ mb: +m[1], t: +m[2] }));
  const tol = 0.3;
  if (!rounds.length) fail("crashtest", "could not parse ROUNDS");
  rounds.forEach((r, i) => {
    let okR = false;
    for (let m = 2; m <= 10 && !okR; m++) for (let v = 2; v <= 10; v += 0.5) if (Math.abs((m * v) / (m + r.mb) - r.t) <= tol) { okR = true; break; }
    if (!okR) fail("crashtest", `round ${i + 1} (mB ${r.mb}, target ${r.t}) unreachable with the sliders`);
  });
  if (rounds.length && failures.length === n) pass("crashtest", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("crashtest", String(e));
}

// --- cocoa: max insulation (10) must keep temp ≥ target at the check time. ------
try {
  const n = failures.length;
  const src = read("src/games/cocoa/index.ts");
  const T0 = 90, ENV = 20;
  const coolingK = (i) => 0.12 / (1 + i * 0.45);
  const tempAt = (i, min) => ENV + (T0 - ENV) * Math.exp(-coolingK(i) * min);
  const rounds = [...src.matchAll(/target:\s*(\d+),\s*checkMin:\s*(\d+)/g)].map((m) => ({ t: +m[1], c: +m[2] }));
  if (!rounds.length) fail("cocoa", "could not parse ROUNDS");
  rounds.forEach((r, i) => {
    if (tempAt(10, r.c) < r.t) fail("cocoa", `round ${i + 1} can't stay ≥ ${r.t}°C at ${r.c} min even fully insulated`);
  });
  if (rounds.length && failures.length === n) pass("cocoa", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("cocoa", String(e));
}

// --- orbitlab: circular speed √(GM/r0) must be inside the slider range ±tol. ----
try {
  const n = failures.length;
  const src = read("src/games/orbitlab/index.ts");
  const GM = +(src.match(/GM\s*=\s*(\d+)/)?.[1] ?? 3200);
  const rounds = [...src.matchAll(/r0:\s*(\d+)/g)].map((m) => +m[1]);
  const tol = 0.25, lo = 1, hi = 8;
  if (!rounds.length) fail("orbitlab", "could not parse ROUNDS");
  rounds.forEach((r0, i) => {
    const v = Math.sqrt(GM / r0);
    if (v - tol < lo || v + tol > hi) fail("orbitlab", `round ${i + 1} orbit speed ${v.toFixed(1)} outside slider ${lo}–${hi}`);
  });
  if (rounds.length && failures.length === n) pass("orbitlab", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("orbitlab", String(e));
}

// --- tugforces: your pull = enemy + targetNet must be within the slider [0,100]. -
try {
  const n = failures.length;
  const src = read("src/games/tugforces/index.ts");
  const rounds = [...src.matchAll(/enemy:\s*(\d+),\s*targetNet:\s*(-?\d+)/g)].map((m) => ({ e: +m[1], t: +m[2] }));
  if (!rounds.length) fail("tugforces", "could not parse ROUNDS");
  rounds.forEach((r, i) => {
    const need = r.e + r.t;
    if (need < 0 || need > 100) fail("tugforces", `round ${i + 1} needs pull ${need}N, outside slider 0–100`);
  });
  if (rounds.length && failures.length === n) pass("tugforces", `${rounds.length} rounds solvable`);
} catch (e) {
  fail("tugforces", String(e));
}

// --- forces (Push It!): every surface must have a push (2..14, step 0.5) that
//     stops the box centred in the target zone. Simulates the exact discrete
//     slide; uses the tightest (master) zone width. -----------------------------
try {
  const n = failures.length;
  const src = read("src/games/forces/index.ts");
  const frictions = [...src.matchAll(/friction:\s*([\d.]+)/g)].map((m) => +m[1]);
  const W = 800, BOX = 70, START_X = 90, zoneX = 560, zoneW = 64; // master zone (tightest)
  const center = (push, fr) => {
    let x = START_X, v = push * 1.4;
    for (let i = 0; i < 6000; i++) {
      x += v;
      v = Math.max(0, v - fr * 9);
      if (v <= 0 || x + BOX > W) break;
    }
    return Math.min(x, W - BOX) + BOX / 2;
  };
  if (!frictions.length) fail("forces", "could not parse SURFACES");
  frictions.forEach((fr, i) => {
    let okR = false;
    for (let p = 2; p <= 14; p += 0.5) {
      const cen = center(p, fr);
      if (cen >= zoneX && cen <= zoneX + zoneW) { okR = true; break; }
    }
    if (!okR) fail("forces", `surface #${i + 1} (friction ${fr}) can't stop in the zone at any push`);
  });
  if (frictions.length && failures.length === n) pass("forces", `${frictions.length} surfaces solvable`);
} catch (e) {
  fail("forces", String(e));
}

// --- report ---
for (const line of ok) console.log(line);
if (failures.length) {
  console.error("\n🚫 Solvability check FAILED:\n" + failures.join("\n") + "\n");
  process.exit(1);
}
console.log("✅ Solvability check passed.");
