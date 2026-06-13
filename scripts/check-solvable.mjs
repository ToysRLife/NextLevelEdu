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

// --- report ---
for (const line of ok) console.log(line);
if (failures.length) {
  console.error("\n🚫 Solvability check FAILED:\n" + failures.join("\n") + "\n");
  process.exit(1);
}
console.log("✅ Solvability check passed.");
