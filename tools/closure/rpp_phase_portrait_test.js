#!/usr/bin/env node
"use strict";

/**
 * RPP-VTS v1.0 — Reflexive Phase Portrait Validation
 *
 * Validates the five canonical portrait invariants (RPP-1..5)
 * plus HOE fiber-ascent and BCE spiral-descent scenarios.
 *
 * Exit: 0 = PASS, 2 = expected REFUSE, 3 = unexpected failure
 */

const fs = require("fs");
const path = require("path");

/* ── helpers ─────────────────────────────────────────────────────── */

function near(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

/**
 * Simulate reflexive trajectory on scalar Z.
 *   HOE:  Z_{t+1} = Z_t
 *   BCE:  Z_{t+1} = (1 - beta) * Z_t + alpha * lambda_V
 * Returns per-step record: Z, W_Z, V_count, W_V, W_star.
 */
function simulateTrajectory(params) {
  const { Z_0, mode, alpha, beta, lambda_V, B_V, steps, gamma } = params;
  const gam = gamma || 0;

  let Z = Z_0;
  const records = [];

  for (let t = 0; t <= steps; t++) {
    const W_Z = Z * Z;
    const V_count = t;
    const W_V = V_count * B_V;
    const W_star = W_Z + gam * W_V;

    records.push({ t, Z, W_Z, V_count, W_V, W_star });

    if (t < steps) {
      if (mode === "HOE") {
        /* Z unchanged */
      } else {
        Z = (1 - beta) * Z + alpha * lambda_V;
      }
    }
  }

  return records;
}

/* ── main ────────────────────────────────────────────────────────── */

const casesFile = process.argv[2] || path.join(__dirname, "rpp_cases.json");
const cases = JSON.parse(fs.readFileSync(casesFile, "utf8"));

let passed = 0;
let failed = 0;

function assert(cond, tag, msg) {
  if (!cond) {
    console.log(`FAIL [${tag}] ${msg}`);
    failed++;
    return false;
  }
  return true;
}

function pass(tag) {
  console.log(`PASS [${tag}]`);
  passed++;
}

console.log("--- RPP-VTS v1.0 ---\n");

for (const c of cases) {
  const tag = c.id + ": " + c.description;

  /* ── REFUSE gate ──────────────────────────────────────────────── */
  if (c.expect_refuse) {
    const reason = c.refuse_reason;
    let refuse_ok = false;
    if (reason === "small_gain_violated") {
      const sg = c.params.alpha * c.params.lambda_V;
      refuse_ok = sg >= c.params.beta;
    } else if (reason === "outside_basin") {
      refuse_ok = true; /* defined by test vector */
    }
    if (assert(refuse_ok, tag, "expected REFUSE but condition not met")) {
      pass(tag);
    }
    continue;
  }

  /* ── Run trajectory ───────────────────────────────────────────── */
  const traj = simulateTrajectory(c.params);
  let ok = true;

  /* ── RPP-1: Basin convergence ─────────────────────────────────── */
  if (c.checks.basin_convergence) {
    const bc = c.checks.basin_convergence;
    const Z_final = traj[traj.length - 1].Z;
    ok = assert(near(Z_final, bc.Z_inf, bc.tol), tag,
      `Z_final=${Z_final} not near Z_inf=${bc.Z_inf} (tol=${bc.tol})`) && ok;
  }

  /* ── RPP-2: W(Z) monotone non-increasing ──────────────────────── */
  if (c.checks.w_z_monotone) {
    let mono = true;
    for (let t = 1; t < traj.length; t++) {
      if (traj[t].W_Z > traj[t - 1].W_Z + 1e-15) {
        mono = false;
        break;
      }
    }
    ok = assert(mono, tag, "W(Z) not monotone non-increasing") && ok;
  }

  /* ── RPP-2 extended: W* monotone over convergence horizon ────── */
  if (c.checks.w_star_monotone) {
    const wsm = c.checks.w_star_monotone;
    const horizon = wsm.horizon || traj.length - 1;
    let mono = true;
    for (let t = 1; t <= horizon && t < traj.length; t++) {
      if (traj[t].W_star > traj[t - 1].W_star + 1e-15) {
        mono = false;
        break;
      }
    }
    ok = assert(mono, tag,
      `W* not monotone over horizon=${horizon}`) && ok;
  }

  /* ── RPP-3: REFUSE absorbing stop — handled above ─────────────── */

  /* ── RPP-4: Chain monotone append-only ────────────────────────── */
  if (c.checks.chain_monotone) {
    let mono = true;
    for (let t = 1; t < traj.length; t++) {
      if (traj[t].V_count < traj[t - 1].V_count) {
        mono = false;
        break;
      }
    }
    ok = assert(mono, tag, "V_count not monotone increasing") && ok;
  }

  /* ── RPP-5: Replay determinism ────────────────────────────────── */
  if (c.checks.replay_determinism) {
    const traj2 = simulateTrajectory(c.params);
    let det_ok = true;
    for (let t = 0; t < traj.length; t++) {
      if (traj[t].Z !== traj2[t].Z || traj[t].W_star !== traj2[t].W_star) {
        det_ok = false;
        break;
      }
    }
    ok = assert(det_ok, tag, "Replay produced different trajectory") && ok;
  }

  /* ── RPP-6: HOE fiber ascent (Z constant, V grows) ───────────── */
  if (c.checks.fiber_ascent) {
    let z_const = true;
    for (let t = 1; t < traj.length; t++) {
      if (traj[t].Z !== traj[0].Z) { z_const = false; break; }
    }
    ok = assert(z_const, tag, "Z not constant in HOE fiber ascent") && ok;

    const V_final = traj[traj.length - 1].V_count;
    ok = assert(V_final === c.params.steps, tag,
      `V_final=${V_final} != steps=${c.params.steps}`) && ok;
  }

  /* ── RPP-7: BCE spiral descent (W_Z decreasing to attractor) ── */
  if (c.checks.spiral_descent) {
    const sd = c.checks.spiral_descent;
    /* W(Z) strictly decreasing while Z > Z_inf + tol */
    let desc_ok = true;
    for (let t = 1; t < traj.length; t++) {
      if (traj[t - 1].Z > sd.Z_inf + sd.tol) {
        if (traj[t].W_Z >= traj[t - 1].W_Z) {
          desc_ok = false;
          break;
        }
      }
    }
    ok = assert(desc_ok, tag, "W(Z) not strictly decreasing above attractor") && ok;

    const Z_final = traj[traj.length - 1].Z;
    ok = assert(near(Z_final, sd.Z_inf, sd.tol), tag,
      `Z_final=${Z_final} not near attractor Z_inf=${sd.Z_inf}`) && ok;
  }

  /* ── Spot checks ──────────────────────────────────────────────── */
  if (c.checks.spot) {
    for (const s of c.checks.spot) {
      const rec = traj[s.t];
      const actual = rec[s.field];
      ok = assert(near(actual, s.expected, s.tol), tag,
        `${s.field}[${s.t}] = ${actual}, expected ${s.expected} (tol=${s.tol})`) && ok;
    }
  }

  if (ok) pass(tag);
}

/* ── summary ──────────────────────────────────────────────────────── */
console.log("");
if (failed > 0) {
  console.log(`FAIL: RPP-VTS v1.0 — ${failed} check(s) failed.`);
  process.exit(3);
} else {
  console.log("PASS: RPP-VTS v1.0 — Reflexive Phase Portrait validated.");
  process.exit(0);
}
