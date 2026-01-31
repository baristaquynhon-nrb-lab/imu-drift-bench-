#!/usr/bin/env node
/**
 * CCEP-VTS v1.0 — Coupling Constant Estimation Protocol Validation Test Suite
 *
 * Layer: 1.2.aj
 * Validates: K_ML, K_LT, K_C estimation from drift trajectories,
 *            outlier robustness, determinism, edge-case handling.
 *
 * Exit codes:
 *   0 = PASS
 *   2 = FAIL
 *   3 = REFUSE
 *
 * Usage:
 *   node ccep_coupling_constant_test.js <coupling_constant_cases.json>
 */

"use strict";

const fs = require("fs");

/* ── CLI guard ─────────────────────────────────────────────── */

const file = process.argv[2];
if (!file) {
  console.error("REFUSE: missing coupling_constant_cases.json");
  process.exit(3);
}
if (!fs.existsSync(file)) {
  console.error(`REFUSE: file not found — ${file}`);
  process.exit(3);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf-8"));
} catch (e) {
  console.error(`REFUSE: invalid JSON — ${e.message}`);
  process.exit(3);
}

const cases = data.cases || [];
if (!Array.isArray(cases) || cases.length === 0) {
  console.error("REFUSE: no cases found.");
  process.exit(3);
}

/* ── IEEE-754 safety ──────────────────────────────────────── */

function isFiniteNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

/* ── Statistical helpers (deterministic) ──────────────────── */

function medianSorted(sorted) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function q99Filter(arr) {
  if (arr.length === 0) return [];
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.floor(0.99 * (sorted.length - 1));
  const threshold = sorted[idx];
  return sorted.filter((x) => x <= threshold);
}

/* ── CCEP estimator (spec 1.2.aj) ─────────────────────────── */

const MIN_N = 5;

function ccepEstimate(steps) {
  // Validate inputs
  if (!Array.isArray(steps) || steps.length === 0) {
    return { verdict: "REFUSE", reason: "EMPTY" };
  }

  // Separate CG_OK and CG_FAIL groups
  const okM = [], okL = [], okX = [], okC = [];
  const failL = [];

  for (const s of steps) {
    if (
      !isFiniteNum(s.delta_M) || !isFiniteNum(s.delta_L) ||
      !isFiniteNum(s.delta_X) || !isFiniteNum(s.delta_C)
    ) {
      return { verdict: "REFUSE", reason: "NON_FINITE_DRIFT" };
    }
    if (s.cg_ok === true) {
      okM.push(Math.abs(s.delta_M));
      okL.push(Math.abs(s.delta_L));
      okX.push(Math.abs(s.delta_X));
      okC.push(Math.abs(s.delta_C));
    } else {
      failL.push(Math.abs(s.delta_L));
    }
  }

  // Q99 filter each axis
  const fM = q99Filter(okM);
  const fL = q99Filter(okL);
  const fX = q99Filter(okX);
  const fFailL = q99Filter(failL);

  // Check minimum sample size for K_ML and K_LT
  if (fM.length < MIN_N || fL.length < MIN_N || fX.length < MIN_N) {
    return { verdict: "REFUSE", reason: "INSUFFICIENT_ADMISSIBLE" };
  }

  // Compute medians
  const medM = medianSorted(fM.slice().sort((a, b) => a - b));
  const medL = medianSorted(fL.slice().sort((a, b) => a - b));
  const medX = medianSorted(fX.slice().sort((a, b) => a - b));

  // K_ML = median(|ΔL|) / median(|ΔM|)
  const K_ML = medM === 0 ? null : medL / medM;

  // K_LT = median(|ΔX|) / median(|ΔL|)
  const K_LT = medL === 0 ? null : medX / medL;

  // K_C = median(|ΔL| | CG_OK) / median(|ΔL| | CG_FAIL)
  let K_C = null;
  if (fFailL.length >= MIN_N) {
    const medFailL = medianSorted(fFailL.slice().sort((a, b) => a - b));
    K_C = medFailL === 0 ? null : medL / medFailL;
  }

  return {
    verdict: "PASS",
    K_ML,
    K_LT,
    K_C,
    n_admissible: okM.length,
    n_inadmissible: failL.length,
    _medians: { medM, medL, medX },
  };
}

/* ── VTS Runner ───────────────────────────────────────────── */

console.log("\n--- CCEP-VTS v1.0 ---\n");

let allPass = true;

cases.forEach((tc) => {
  const name = tc.name || "unnamed";
  const steps = tc.steps || [];
  const tol = tc.tol != null ? tc.tol : 1e-12;
  const expectRefuse = tc.expect_refuse === true;
  const violations = [];

  // Run twice for determinism (CCEP-1)
  const out1 = ccepEstimate(steps);
  const out2 = ccepEstimate(steps);

  // Handle expected REFUSE
  if (expectRefuse) {
    if (out1.verdict === "REFUSE") {
      console.log(`PASS [${name}]`);
      return;
    }
    violations.push(`Expected REFUSE but got ${out1.verdict}`);
    allPass = false;
    console.log(`FAIL [${name}]`);
    violations.forEach((v) => console.log(`      → ${v}`));
    return;
  }

  if (out1.verdict !== "PASS") {
    violations.push(`CCEP returned ${out1.verdict}: ${out1.reason}`);
    allPass = false;
    console.log(`FAIL [${name}]`);
    violations.forEach((v) => console.log(`      → ${v}`));
    return;
  }

  // CCEP-1: Determinism
  if (
    out1.K_ML !== out2.K_ML ||
    out1.K_LT !== out2.K_LT ||
    out1.K_C !== out2.K_C
  ) {
    violations.push("CCEP-1: non-deterministic K values");
  }

  // CCEP-2: K_ML correctness
  if (tc.expect && tc.expect.K_ML !== undefined) {
    if (tc.expect.K_ML === null) {
      if (out1.K_ML !== null) {
        violations.push(`CCEP-2: K_ML expected null, got ${out1.K_ML}`);
      }
    } else {
      if (out1.K_ML === null) {
        violations.push(`CCEP-2: K_ML expected ${tc.expect.K_ML}, got null`);
      } else {
        const diff = Math.abs(out1.K_ML - tc.expect.K_ML);
        if (diff > tol) {
          violations.push(
            `CCEP-2: K_ML=${out1.K_ML}, expected=${tc.expect.K_ML}, diff=${diff}`
          );
        }
      }
    }
  }

  // CCEP-2: K_LT correctness
  if (tc.expect && tc.expect.K_LT !== undefined) {
    if (tc.expect.K_LT === null) {
      if (out1.K_LT !== null) {
        violations.push(`CCEP-2: K_LT expected null, got ${out1.K_LT}`);
      }
    } else {
      if (out1.K_LT === null) {
        violations.push(`CCEP-2: K_LT expected ${tc.expect.K_LT}, got null`);
      } else {
        const diff = Math.abs(out1.K_LT - tc.expect.K_LT);
        if (diff > tol) {
          violations.push(
            `CCEP-2: K_LT=${out1.K_LT}, expected=${tc.expect.K_LT}, diff=${diff}`
          );
        }
      }
    }
  }

  // CCEP-3: K_C correctness
  if (tc.expect && tc.expect.K_C !== undefined) {
    if (tc.expect.K_C === null) {
      if (out1.K_C !== null) {
        violations.push(`CCEP-3: K_C expected null, got ${out1.K_C}`);
      }
    } else {
      if (out1.K_C === null) {
        violations.push(`CCEP-3: K_C expected ${tc.expect.K_C}, got null`);
      } else {
        const diff = Math.abs(out1.K_C - tc.expect.K_C);
        if (diff > tol) {
          violations.push(
            `CCEP-3: K_C=${out1.K_C}, expected=${tc.expect.K_C}, diff=${diff}`
          );
        }
      }
    }
  }

  const ok = violations.length === 0;
  if (!ok) allPass = false;

  console.log(ok ? `PASS [${name}]` : `FAIL [${name}]`);
  violations.forEach((v) => console.log(`      → ${v}`));
});

/* ── Summary ──────────────────────────────────────────────── */

console.log("");
if (!allPass) {
  console.log("FAIL: CCEP-VTS v1.0 — violations detected.\n");
  process.exit(2);
}
console.log("PASS: CCEP-VTS v1.0 — Coupling constant estimation validated.\n");
process.exit(0);
