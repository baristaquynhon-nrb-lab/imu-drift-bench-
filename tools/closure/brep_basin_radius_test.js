#!/usr/bin/env node
/**
 * BREP-VTS v1.0 — Basin Radius Estimation Protocol Validation Test Suite
 *
 * Layer: 1.2.ai
 * Validates: ε_L_hat estimation, m_hat estimation, partition completeness,
 *            coherence boundary dominance, determinism.
 *
 * Exit codes:
 *   0 = PASS
 *   2 = FAIL
 *   3 = REFUSE
 *
 * Usage:
 *   node brep_basin_radius_test.js <basin_radius_cases.json>
 */

"use strict";

const fs = require("fs");

/* ── CLI guard ─────────────────────────────────────────────── */

const file = process.argv[2];
if (!file) {
  console.error("REFUSE: missing basin_radius_cases.json");
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

function isFiniteNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

/* ── Statistical helpers (deterministic, spec-accurate) ───── */

function medianSorted(sorted) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantileFloor(sorted, p) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const idx = Math.floor(p * (n - 1));
  return sorted[idx];
}

function madSorted(sorted) {
  const med = medianSorted(sorted);
  const dev = sorted.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
  return medianSorted(dev);
}

/* ── BREP estimator (spec 1.2.ai.4) ──────────────────────── */

function brepEstimate(drifts, cg_ok, opts) {
  const p = opts.p != null ? opts.p : 0.95;
  const k = opts.k != null ? opts.k : 1.0;
  const m_min = opts.m_min != null ? opts.m_min : 0.02;
  const eps_min = opts.eps_min != null ? opts.eps_min : 1e-6;
  const eps_max = opts.eps_max != null ? opts.eps_max : 1e6;

  // Input validation
  if (
    !Array.isArray(drifts) ||
    !Array.isArray(cg_ok) ||
    drifts.length !== cg_ok.length
  ) {
    return { verdict: "REFUSE", reason: "MALFORMED_INPUT" };
  }
  if (drifts.length < 1) {
    return { verdict: "REFUSE", reason: "EMPTY" };
  }

  // Collect admissible drift set D
  const D = [];
  for (let i = 0; i < drifts.length; i++) {
    const d = drifts[i];
    if (!isFiniteNumber(d)) {
      return { verdict: "REFUSE", reason: "NON_FINITE_DRIFT" };
    }
    if (cg_ok[i] === true) D.push(d);
  }
  if (D.length < 3) {
    return { verdict: "REFUSE", reason: "INSUFFICIENT_ADMISSIBLE" };
  }

  const D_sorted = D.slice().sort((a, b) => a - b);

  // R1: ε_L estimation
  const eps_hat_raw = quantileFloor(D_sorted, p);
  if (!isFiniteNumber(eps_hat_raw)) {
    return { verdict: "REFUSE", reason: "NON_FINITE_EPS" };
  }
  let epsilon_L_hat = Math.min(Math.max(eps_hat_raw, eps_min), eps_max);

  // R2: m estimation
  const med = medianSorted(D_sorted);
  const mad_val = madSorted(D_sorted);
  const sigma_hat = 1.4826 * mad_val;
  let m_hat = Math.max(m_min, k * sigma_hat);

  if (!isFiniteNumber(m_hat) || m_hat <= 0) {
    return { verdict: "REFUSE", reason: "INVALID_M" };
  }

  // R3: clamp m < epsilon_L_hat
  if (m_hat >= epsilon_L_hat) {
    const clamped = 0.5 * epsilon_L_hat;
    if (clamped <= 0) {
      return { verdict: "REFUSE", reason: "M_GE_EPS" };
    }
    m_hat = clamped;
  }

  // Derive labels per 1.2.ai.5
  const labels = drifts.map((d, i) => {
    if (cg_ok[i] === false) return "Mutation";
    if (d > epsilon_L_hat + m_hat) return "Mutation";
    if (d < epsilon_L_hat - m_hat) return "Stable";
    // |d - epsilon_L_hat| <= m_hat (within shell)
    return "Transition";
  });

  return {
    verdict: "PASS",
    epsilon_L_hat,
    m_hat,
    p,
    k,
    m_min,
    n_admissible: D.length,
    median: med,
    mad: mad_val,
    sigma_hat,
    labels,
  };
}

/* ── VTS Runner ───────────────────────────────────────────── */

console.log("\n--- BREP-VTS v1.0 ---\n");

let allPass = true;

cases.forEach((tc) => {
  const name = tc.name || "unnamed";
  const drifts = tc.drifts;
  const cg_ok = tc.cg_ok;
  const opts = tc.params || {};
  const tol = tc.tol != null ? tc.tol : 1e-12;
  const violations = [];

  // Run BREP twice for determinism check (BREP-1)
  const out1 = brepEstimate(drifts, cg_ok, opts);
  const out2 = brepEstimate(drifts, cg_ok, opts);

  if (out1.verdict !== "PASS") {
    violations.push(`BREP returned ${out1.verdict}: ${out1.reason}`);
    allPass = false;
    console.log(`FAIL [${name}]`);
    violations.forEach((v) => console.log(`      → ${v}`));
    return;
  }

  // BREP-1: Determinism
  const det_ok =
    out1.epsilon_L_hat === out2.epsilon_L_hat &&
    out1.m_hat === out2.m_hat &&
    JSON.stringify(out1.labels) === JSON.stringify(out2.labels);

  if (!det_ok) {
    violations.push("BREP-1: non-deterministic outputs on identical inputs");
  }

  // BREP-2: Quantile boundary correctness
  if (tc.expect && tc.expect.quantile_eps != null) {
    const diff = Math.abs(out1.epsilon_L_hat - tc.expect.quantile_eps);
    if (diff > tol) {
      violations.push(
        `BREP-2: ε_L_hat=${out1.epsilon_L_hat}, expected=${tc.expect.quantile_eps}, diff=${diff}`
      );
    }
  }

  // BREP-3: Robust shell width correctness
  if (tc.expect && tc.expect.m_hat != null) {
    const diff = Math.abs(out1.m_hat - tc.expect.m_hat);
    if (diff > tol) {
      violations.push(
        `BREP-3: m_hat=${out1.m_hat}, expected=${tc.expect.m_hat}, diff=${diff}`
      );
    }
  }

  // BREP-4: Partition completeness (every label is valid)
  const validLabels = new Set(["Stable", "Transition", "Mutation"]);
  const labelOk = out1.labels.every((l) => validLabels.has(l));
  if (!labelOk) {
    violations.push("BREP-4: invalid label found in partition");
  }
  if (out1.labels.length !== drifts.length) {
    violations.push(
      `BREP-4: label count (${out1.labels.length}) ≠ drift count (${drifts.length})`
    );
  }

  // BREP-5: Coherence boundary dominance
  for (let i = 0; i < cg_ok.length; i++) {
    if (cg_ok[i] === false && out1.labels[i] !== "Mutation") {
      violations.push(
        `BREP-5: step ${i} cg_ok=false but label=${out1.labels[i]}`
      );
      break;
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
  console.log("FAIL: BREP-VTS v1.0 — violations detected.\n");
  process.exit(2);
}
console.log("PASS: BREP-VTS v1.0 — Basin radius estimation validated.\n");
process.exit(0);
