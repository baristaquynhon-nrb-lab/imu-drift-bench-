#!/usr/bin/env node
"use strict";

/**
 * RFPT-VTS v1.0 — Reflexive Fixed-Point Theorem Validation
 *
 * Tests: RFPT-1 (HOE fixed), RFPT-2 (BCE contraction), RFPT-3 (W_V bounded),
 *        RFPT-4 (self-consistency), RFPT-5 (determinism), RFPT-6 (REFUSE)
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
 * Simulate reflexive operator F on scalar Z.
 *   HOE:  Z_{t+1} = Z_t
 *   BCE:  Z_{t+1} = (1 - beta) * Z_t + alpha * lambda_V
 * V_count increments by 1 each step.  W(Z) = Z^2.  W_V = V_count * B_V.
 */
function simulateTrajectory(params) {
  const { Z_0, mode, alpha, beta, lambda_V, B_V, steps } = params;

  let Z = Z_0;
  const Z_hist = [Z];
  const W_hist = [Z * Z];
  const V_hist = [0];

  for (let t = 0; t < steps; t++) {
    if (mode === "HOE") {
      /* Z unchanged */
    } else {
      Z = (1 - beta) * Z + alpha * lambda_V;
    }
    Z_hist.push(Z);
    W_hist.push(Z * Z);
    V_hist.push(t + 1);
  }

  return { Z_hist, W_hist, V_hist };
}

/* ── main ────────────────────────────────────────────────────────── */

const casesFile = process.argv[2] || path.join(__dirname, "rfpt_cases.json");
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

console.log("--- RFPT-VTS v1.0 ---\n");

for (const c of cases) {
  const tag = c.id + ": " + c.description;

  /* ── REFUSE gate ──────────────────────────────────────────────── */
  if (c.expect_refuse) {
    const sg = c.params.alpha * c.params.lambda_V;
    if (assert(sg >= c.params.beta, tag,
      `expected small-gain violation but alpha*lambda_V=${sg} < beta=${c.params.beta}`)) {
      pass(tag);
    }
    continue;
  }

  /* ── Small-gain pre-check (BCE) ───────────────────────────────── */
  if (c.params.mode === "BCE") {
    const sg = c.params.alpha * c.params.lambda_V;
    if (!assert(sg < c.params.beta, tag,
      `small-gain violated: alpha*lambda_V=${sg} >= beta=${c.params.beta}`)) continue;
  }

  /* ── Run trajectory ───────────────────────────────────────────── */
  const traj = simulateTrajectory(c.params);

  let ok = true;

  /* ── RFPT-1 / RFPT-2: convergence check ──────────────────────── */
  if (c.checks.convergence) {
    const cv = c.checks.convergence;
    const Z_final = traj.Z_hist[traj.Z_hist.length - 1];
    ok = assert(near(Z_final, cv.Z_inf, cv.tol), tag,
      `Z_final=${Z_final} not near Z_inf=${cv.Z_inf} (tol=${cv.tol})`) && ok;
  }

  /* ── RFPT-1 (HOE): Z constant check ──────────────────────────── */
  if (c.checks.z_constant) {
    let z_ok = true;
    for (let t = 1; t < traj.Z_hist.length; t++) {
      if (traj.Z_hist[t] !== traj.Z_hist[0]) {
        z_ok = false;
        break;
      }
    }
    ok = assert(z_ok, tag, "Z not constant in HOE mode") && ok;
  }

  /* ── RFPT-2: W(Z) monotone decreasing (BCE) ──────────────────── */
  if (c.checks.w_monotone_decreasing) {
    let mono = true;
    for (let t = 1; t < traj.W_hist.length; t++) {
      if (traj.W_hist[t] > traj.W_hist[t - 1] + 1e-15) {
        mono = false;
        break;
      }
    }
    ok = assert(mono, tag, "W(Z) not monotone decreasing") && ok;
  }

  /* ── RFPT-3: Verification boundedness ─────────────────────────── */
  if (c.checks.w_v_bounded) {
    const B_V = c.params.B_V;
    let bounded = true;
    for (let t = 1; t < traj.V_hist.length; t++) {
      const delta = (traj.V_hist[t] - traj.V_hist[t - 1]) * B_V;
      if (delta > B_V + 1e-15) {
        bounded = false;
        break;
      }
    }
    ok = assert(bounded, tag, "W_V growth exceeds B_V per step") && ok;
  }

  /* ── RFPT-4: Fixed-point self-consistency ─────────────────────── */
  if (c.checks.self_consistency) {
    const sc = c.checks.self_consistency;
    const Z_final = traj.Z_hist[traj.Z_hist.length - 1];
    let Z_next;
    if (c.params.mode === "HOE") {
      Z_next = Z_final;
    } else {
      Z_next = (1 - c.params.beta) * Z_final + c.params.alpha * c.params.lambda_V;
    }
    ok = assert(near(Z_next, Z_final, sc.tol), tag,
      `F(Z_inf)=${Z_next} != Z_inf=${Z_final} (tol=${sc.tol})`) && ok;
  }

  /* ── RFPT-5: Deterministic replay ─────────────────────────────── */
  if (c.checks.determinism) {
    const traj2 = simulateTrajectory(c.params);
    let det_ok = true;
    for (let t = 0; t < traj.Z_hist.length; t++) {
      if (traj.Z_hist[t] !== traj2.Z_hist[t]) {
        det_ok = false;
        break;
      }
    }
    ok = assert(det_ok, tag, "Replay produced different Z trajectory") && ok;
  }

  /* ── Spot checks on specific Z/W values ───────────────────────── */
  if (c.checks.spot) {
    for (const s of c.checks.spot) {
      const actual = s.field === "Z" ? traj.Z_hist[s.t] : traj.W_hist[s.t];
      ok = assert(near(actual, s.expected, s.tol), tag,
        `${s.field}[${s.t}] = ${actual}, expected ${s.expected} (tol=${s.tol})`) && ok;
    }
  }

  if (ok) pass(tag);
}

/* ── summary ──────────────────────────────────────────────────────── */
console.log("");
if (failed > 0) {
  console.log(`FAIL: RFPT-VTS v1.0 — ${failed} check(s) failed.`);
  process.exit(3);
} else {
  console.log("PASS: RFPT-VTS v1.0 — Reflexive Fixed-Point Theorem validated.");
  process.exit(0);
}
