#!/usr/bin/env node
"use strict";

/**
 * REBT-VTS v1.0 — Representation–Epistemic Boundary Theorem Validation
 *
 * Model: ℋ = ℝ⁴, ΔP = ℝ² (first 2 components).
 *   Encode(dp) = [dp[0], dp[1], 0, 0]
 *   Decode(h)  = [h[0], h[1]]
 *   T is a 4×4 matrix (row-major)
 *
 * RP criterion: T[0:2, 0:2] = I₂  (boundary law)
 * EP criterion: T[0:2, 0:2] ≠ I₂
 *
 * Tests: REBT-1..9 covering RP/EP classification, gauge group closure,
 *        CG gate enforcement, near-identity detection, determinism.
 *
 * Exit: 0 = PASS, 3 = unexpected failure
 */

const fs = require("fs");
const path = require("path");

/* ── linear algebra helpers ──────────────────────────────────────── */

function matVec(M, v) {
  return M.map(row => row.reduce((s, m, j) => s + m * v[j], 0));
}

function matMul(A, B) {
  const n = A.length;
  const R = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++)
        R[i][j] += A[i][k] * B[k][j];
  return R;
}

function encode(dp) { return [dp[0], dp[1], 0, 0]; }
function decode(h) { return [h[0], h[1]]; }

function roundTrip(T, dp) {
  return decode(matVec(T, encode(dp)));
}

/**
 * Classify operator as RP or EP using the boundary law:
 * T ∈ RP ⇔ T[0:2, 0:2] = I₂ (within tolerance)
 */
function classifyOperator(T, tol) {
  tol = tol || 1e-12;
  const ok = Math.abs(T[0][0] - 1) < tol &&
             Math.abs(T[0][1]) < tol &&
             Math.abs(T[1][0]) < tol &&
             Math.abs(T[1][1] - 1) < tol;
  return ok ? "RP" : "EP";
}

/**
 * Check round-trip preservation for a set of test ΔP vectors.
 */
function checkRoundTrips(T, testVecs, tol) {
  tol = tol || 1e-12;
  for (const dp of testVecs) {
    const rt = roundTrip(T, dp);
    if (Math.abs(rt[0] - dp[0]) > tol || Math.abs(rt[1] - dp[1]) > tol) {
      return { preserved: false, dp, rt };
    }
  }
  return { preserved: true };
}

/* ── near helper ─────────────────────────────────────────────────── */

function near(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

/* ── main ────────────────────────────────────────────────────────── */

const casesFile = process.argv[2] || path.join(__dirname, "rebt_cases.json");
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

console.log("--- REBT-VTS v1.0 ---\n");

/* Standard test ΔP vectors */
const stdVecs = [[1, 0], [0, 1], [0.5, 0.75], [-1, 2]];

for (const c of cases) {
  const tag = c.id + ": " + c.description;
  let ok = true;

  /* ── Classification check ─────────────────────────────────────── */
  if (c.checks.classify) {
    const cls = classifyOperator(c.operator, c.checks.classify.tol || 1e-12);
    ok = assert(cls === c.checks.classify.expected, tag,
      `classified as ${cls}, expected ${c.checks.classify.expected}`) && ok;
  }

  /* ── Round-trip preservation check ────────────────────────────── */
  if (c.checks.round_trip) {
    const rt = c.checks.round_trip;
    const vecs = rt.test_vecs || stdVecs;
    const result = checkRoundTrips(c.operator, vecs, rt.tol || 1e-12);
    if (rt.expect_preserved) {
      ok = assert(result.preserved, tag,
        `round-trip NOT preserved for dp=${JSON.stringify(result.dp)} → ${JSON.stringify(result.rt)}`) && ok;
    } else {
      ok = assert(!result.preserved, tag,
        "round-trip preserved but expected alteration") && ok;
    }
  }

  /* ── Specific round-trip values check ─────────────────────────── */
  if (c.checks.round_trip_values) {
    for (const v of c.checks.round_trip_values) {
      const rt = roundTrip(c.operator, v.dp);
      ok = assert(near(rt[0], v.expected[0], v.tol) && near(rt[1], v.expected[1], v.tol),
        tag, `RT(${JSON.stringify(v.dp)}) = [${rt}], expected [${v.expected}]`) && ok;
    }
  }

  /* ── CG gate required check ───────────────────────────────────── */
  if (c.checks.cg_required !== undefined) {
    const cls = classifyOperator(c.operator, 1e-12);
    const needsCG = cls === "EP";
    ok = assert(needsCG === c.checks.cg_required, tag,
      `cg_required=${needsCG}, expected ${c.checks.cg_required}`) && ok;
  }

  /* ── Gauge group composition check ────────────────────────────── */
  if (c.checks.composition) {
    const comp = c.checks.composition;
    const T_a = comp.T_a;
    const T_b = comp.T_b;
    const T_composed = matMul(T_a, T_b);

    const cls_a = classifyOperator(T_a);
    const cls_b = classifyOperator(T_b);
    const cls_c = classifyOperator(T_composed);

    ok = assert(cls_a === "RP", tag, `T_a classified ${cls_a}, expected RP`) && ok;
    ok = assert(cls_b === "RP", tag, `T_b classified ${cls_b}, expected RP`) && ok;
    ok = assert(cls_c === comp.expected_class, tag,
      `T_a·T_b classified ${cls_c}, expected ${comp.expected_class}`) && ok;

    /* Verify round-trip on composed */
    if (comp.expected_class === "RP") {
      const result = checkRoundTrips(T_composed, stdVecs);
      ok = assert(result.preserved, tag,
        "composed operator does not preserve round-trip") && ok;
    }
  }

  /* ── Deterministic replay check ───────────────────────────────── */
  if (c.checks.determinism) {
    /* Run classification and round-trips twice */
    const cls1 = classifyOperator(c.operator);
    const cls2 = classifyOperator(c.operator);
    ok = assert(cls1 === cls2, tag, "classification not deterministic") && ok;

    for (const dp of stdVecs) {
      const rt1 = roundTrip(c.operator, dp);
      const rt2 = roundTrip(c.operator, dp);
      ok = assert(rt1[0] === rt2[0] && rt1[1] === rt2[1], tag,
        `replay mismatch for dp=${JSON.stringify(dp)}`) && ok;
    }
  }

  if (ok) pass(tag);
}

/* ── summary ──────────────────────────────────────────────────────── */
console.log("");
if (failed > 0) {
  console.log(`FAIL: REBT-VTS v1.0 — ${failed} check(s) failed.`);
  process.exit(3);
} else {
  console.log("PASS: REBT-VTS v1.0 — Representation–Epistemic Boundary validated.");
  process.exit(0);
}
