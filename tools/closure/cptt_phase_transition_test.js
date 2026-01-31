#!/usr/bin/env node
/**
 * CPTT-VTS v1.0 — CAS Phase Transition Theorem Validation Test Suite
 *
 * Layer: 1.2.ag
 * Validates: Phase boundary correctness, LDBC region soundness,
 *            governance phase-control consistency.
 *
 * Exit codes:
 *   0 = PASS
 *   2 = FAIL
 *   3 = REFUSE (insufficient data)
 *
 * Usage:
 *   node cptt_phase_transition_test.js <phase_transition_cases.json>
 */

"use strict";

const fs = require("fs");

/* ── CLI guard ─────────────────────────────────────────────── */

const file = process.argv[2];
if (!file) {
  console.error("REFUSE: missing phase_transition_cases.json");
  process.exit(3);
}

if (!fs.existsSync(file)) {
  console.error(`REFUSE: file not found — ${file}`);
  process.exit(3);
}

/* ── Load test vectors ─────────────────────────────────────── */

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf-8"));
} catch (e) {
  console.error(`REFUSE: invalid JSON — ${e.message}`);
  process.exit(3);
}

const cases = data.cases || [];
if (cases.length === 0) {
  console.error("REFUSE: no test cases found in input file.");
  process.exit(3);
}

/* ── LDBC Region Classifier ───────────────────────────────── */

const TRANSITION_MARGIN = 0.05; // half-width of transition band

function classifyRegion(drift, cgOk, epsilon_L) {
  // CPTT-2: Coherence saturation → Mutation (regardless of drift)
  if (!cgOk) return "Mutation";

  // CPTT-1: Threshold crossing → Mutation
  if (drift > epsilon_L) return "Mutation";

  // CPTT-3: Transition band (drift within ε_L ± margin, CG admissible)
  if (Math.abs(drift - epsilon_L) < TRANSITION_MARGIN) return "Transition";

  // Default: Stable regime
  return "Stable";
}

/* ── LGO Governance Operator ──────────────────────────────── */

const MUTATION_ACTIONS = new Set(["FORK", "SHIFT", "DEPRECATE"]);

function governanceAction(region) {
  if (region === "Mutation") return "FORK";
  if (region === "Transition") return "PATCH";
  return "NOOP";
}

/* ── Test Runner ──────────────────────────────────────────── */

console.log("\n--- CPTT-VTS v1.0 ---\n");

let allPass = true;
const results = [];

cases.forEach((c) => {
  const name = c.name || "unnamed";
  const drift = c.features.law_drift_algebra;
  const cgOk = c.features.cg_ok;
  const epsilon = c.epsilon_L != null ? c.epsilon_L : 0.2;

  const region = classifyRegion(drift, cgOk, epsilon);
  const action = governanceAction(region);

  const violations = [];

  // ── CPTT-1: Threshold Crossing ──
  if (drift > epsilon && region !== "Mutation") {
    violations.push("CPTT-1: drift > ε_L but region ≠ Mutation");
  }

  // ── CPTT-2: Coherence Saturation ──
  if (!cgOk && region !== "Mutation") {
    violations.push("CPTT-2: CG not OK but region ≠ Mutation");
  }

  // ── CPTT-3: Transition Band ──
  if (c.expect_region === "Transition") {
    if (region !== "Transition") {
      violations.push(
        `CPTT-3: expected Transition but got ${region}`
      );
    }
  }

  // ── CPTT-4: Governance Phase Control ──
  if (region === "Mutation" && !MUTATION_ACTIONS.has(action)) {
    violations.push(
      `CPTT-4: Mutation but action=${action} ∉ {FORK,SHIFT,DEPRECATE}`
    );
  }

  // ── Expected-region cross-check (if provided) ──
  if (c.expect_region && region !== c.expect_region) {
    violations.push(
      `Region mismatch: expected ${c.expect_region}, got ${region}`
    );
  }

  // ── Expected-action cross-check (if provided) ──
  if (c.expect_action && action !== c.expect_action) {
    violations.push(
      `Action mismatch: expected ${c.expect_action}, got ${action}`
    );
  }

  const ok = violations.length === 0;
  if (!ok) allPass = false;

  console.log(ok ? `PASS [${name}]` : `FAIL [${name}]`);
  violations.forEach((v) => console.log(`      → ${v}`));

  results.push({ name, region, action, ok, violations });
});

/* ── Determinism check ────────────────────────────────────── */

// Re-run the same classification; must produce identical output.
let deterministicOk = true;
cases.forEach((c, i) => {
  const drift = c.features.law_drift_algebra;
  const cgOk = c.features.cg_ok;
  const epsilon = c.epsilon_L != null ? c.epsilon_L : 0.2;

  const region2 = classifyRegion(drift, cgOk, epsilon);
  const action2 = governanceAction(region2);

  if (region2 !== results[i].region || action2 !== results[i].action) {
    deterministicOk = false;
    console.log(`FAIL [DETERMINISM] — non-deterministic result for ${c.name}`);
  }
});

if (deterministicOk) {
  console.log("PASS [DETERMINISM]");
} else {
  allPass = false;
}

/* ── Summary ──────────────────────────────────────────────── */

console.log("");
if (!allPass) {
  console.log("FAIL: CPTT-VTS v1.0 — violations detected.\n");
  process.exit(2);
}

console.log("PASS: CPTT-VTS v1.0 — Phase Transition Theorem validated.\n");
process.exit(0);
