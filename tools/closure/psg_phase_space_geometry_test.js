#!/usr/bin/env node
/**
 * PSG-VTS v1.0 — Phase Space Geometry Validation Test Suite
 *
 * Layer: 1.2.ah
 * Validates: Geometric partition soundness, admissible set closure,
 *            multi-step trajectory legality, absorbing-state semantics,
 *            governance phase-selectivity.
 *
 * Exit codes:
 *   0 = PASS
 *   2 = FAIL
 *   3 = REFUSE (insufficient data)
 *
 * Usage:
 *   node psg_phase_space_geometry_test.js <phase_space_cases.json>
 */

"use strict";

const fs = require("fs");

/* ── CLI guard ─────────────────────────────────────────────── */

const file = process.argv[2];
if (!file) {
  console.error("REFUSE: missing phase_space_cases.json");
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

const config = data.config || {};
const DEFAULT_EPSILON = config.epsilon_L || 0.2;
const DEFAULT_MARGIN = config.margin || 0.05;
const RECOVERY_ALLOWED = config.recovery_allowed || false;
const RECOVERY_K = config.recovery_k || 1;

/* ── Region Classifier (PSG-2: symmetric margin) ──────────── */

function classifyRegion(drift, cgOk, epsilon, margin) {
  // PSG-1 / GI-3: CG-inadmissible → Mutation (unconditional)
  if (!cgOk) return "Mutation";

  // PSG-2: symmetric margin around epsilon
  if (drift > epsilon + margin) return "Mutation";
  if (drift < epsilon - margin) return "Stable";

  // |drift - epsilon| <= margin && cgOk
  return "Transition";
}

/* ── Mutation Cause Classifier (PSG-5) ────────────────────── */

function classifyCause(drift, cgOk, epsilon, margin) {
  const highDrift = drift > epsilon + margin;
  const cgFail = !cgOk;

  if (highDrift && cgFail) return "COMPOUND";
  if (highDrift) return "DRIFT";
  if (cgFail) return "COHERENCE";
  return null; // not Mutation
}

/* ── Governance Operator (PSG-5: cause-selective) ─────────── */

const VALID_ACTIONS = {
  DRIFT: new Set(["FORK", "SHIFT"]),
  COHERENCE: new Set(["SHIFT", "DEPRECATE"]),
  COMPOUND: new Set(["FORK", "SHIFT", "DEPRECATE"]),
};

function governanceAction(region, cause) {
  if (region === "Stable") return "NOOP";
  if (region === "Transition") return "PATCH";

  // Mutation: select based on cause
  if (cause === "DRIFT") return "FORK";
  if (cause === "COHERENCE") return "DEPRECATE";
  if (cause === "COMPOUND") return "FORK";
  return "FORK"; // fallback
}

function isValidAction(region, cause, action) {
  if (region === "Stable") return action === "NOOP";
  if (region === "Transition") return action === "PATCH";
  if (region === "Mutation" && cause && VALID_ACTIONS[cause]) {
    return VALID_ACTIONS[cause].has(action);
  }
  return false;
}

/* ── Admissibility Check (PSG-1) ──────────────────────────── */

function isAdmissible(cgOk) {
  return cgOk === true;
}

/* ── Test Runner ──────────────────────────────────────────── */

console.log("\n--- PSG-VTS v1.0 ---\n");

let allPass = true;
const allResults = [];

/* ──────────────────────────────────────────────────────────── */
/*  SINGLE-STEP TESTS (PSG-1, PSG-2, PSG-5)                    */
/* ──────────────────────────────────────────────────────────── */

const singleCases = data.single_step_cases || [];

singleCases.forEach((c) => {
  const name = c.name || "unnamed";
  const drift = c.features.law_drift_algebra;
  const cgOk = c.features.cg_ok;
  const epsilon = c.epsilon_L != null ? c.epsilon_L : DEFAULT_EPSILON;
  const margin = c.margin != null ? c.margin : DEFAULT_MARGIN;

  const region = classifyRegion(drift, cgOk, epsilon, margin);
  const cause = classifyCause(drift, cgOk, epsilon, margin);
  const action = governanceAction(region, cause);
  const admissible = isAdmissible(cgOk);

  const violations = [];

  // PSG-1: Admissible set closure
  if (!cgOk && region !== "Mutation") {
    violations.push("PSG-1: ¬cg_ok but region ≠ Mutation");
  }
  if (!cgOk && admissible) {
    violations.push("PSG-1: ¬cg_ok but marked admissible");
  }

  // PSG-2: Basin & Boundary Shell soundness (symmetric margin)
  if (c.expect_region && region !== c.expect_region) {
    violations.push(
      `PSG-2: expected region=${c.expect_region}, got ${region}`
    );
  }

  // PSG-5: Governance phase-selective
  if (region === "Mutation") {
    if (!cause) {
      violations.push("PSG-5: Mutation but no cause classified");
    }
    if (c.expect_cause && cause !== c.expect_cause) {
      violations.push(
        `PSG-5: expected cause=${c.expect_cause}, got ${cause}`
      );
    }
    if (!isValidAction(region, cause, action)) {
      violations.push(
        `PSG-5: action=${action} invalid for cause=${cause}`
      );
    }
  }

  if (c.expect_action && action !== c.expect_action) {
    violations.push(
      `Action mismatch: expected ${c.expect_action}, got ${action}`
    );
  }

  const ok = violations.length === 0;
  if (!ok) allPass = false;

  console.log(ok ? `PASS [${name}]` : `FAIL [${name}]`);
  violations.forEach((v) => console.log(`      → ${v}`));

  allResults.push({ name, region, cause, action, admissible, ok });
});

/* ──────────────────────────────────────────────────────────── */
/*  MULTI-STEP TRAJECTORY TESTS (PSG-3, PSG-4)                 */
/* ──────────────────────────────────────────────────────────── */

const trajectories = data.trajectory_cases || [];

trajectories.forEach((traj) => {
  const trajName = traj.name || "unnamed-trajectory";
  const steps = traj.steps || [];
  const recoveryAllowed =
    traj.recovery_allowed != null ? traj.recovery_allowed : RECOVERY_ALLOWED;
  const recoveryK = traj.recovery_k != null ? traj.recovery_k : RECOVERY_K;

  if (steps.length < 2) {
    console.log(`PASS [${trajName}] (single step, no transition to check)`);
    allResults.push({ name: trajName, ok: true });
    return;
  }

  const violations = [];

  // Classify all steps with absorbing-state enforcement (PSG-4)
  // Once Mutation is entered, all subsequent steps stay Mutation
  // unless recovery_allowed=true AND k-step recovery rule is satisfied.
  const regions = [];
  let inMutation = false;
  let recoveryCounter = 0; // consecutive steps qualifying for recovery

  steps.forEach((s, i) => {
    const epsilon = s.epsilon_L != null ? s.epsilon_L : DEFAULT_EPSILON;
    const margin = s.margin != null ? s.margin : DEFAULT_MARGIN;
    const rawRegion = classifyRegion(
      s.features.law_drift_algebra,
      s.features.cg_ok,
      epsilon,
      margin
    );

    if (inMutation) {
      if (recoveryAllowed) {
        // Track consecutive recovery-qualifying steps
        const drift = s.features.law_drift_algebra;
        const cgOk = s.features.cg_ok;
        if (drift < epsilon - margin && cgOk) {
          recoveryCounter++;
        } else {
          recoveryCounter = 0;
        }
        // Recovery succeeds only after k qualifying steps
        if (recoveryCounter >= recoveryK && rawRegion === "Stable") {
          inMutation = false;
          recoveryCounter = 0;
          regions.push(rawRegion);
        } else {
          regions.push("Mutation");
        }
      } else {
        // Absorbing: once Mutation, always Mutation
        regions.push("Mutation");
      }
    } else {
      regions.push(rawRegion);
      if (rawRegion === "Mutation") {
        inMutation = true;
        recoveryCounter = 0;
      }
    }
  });

  // PSG-3: Check trajectory legality (on enforced regions)
  for (let i = 1; i < regions.length; i++) {
    const from = regions[i - 1];
    const to = regions[i];
    const step = steps[i];
    const drift = step.features.law_drift_algebra;
    const cgOk = step.features.cg_ok;
    const epsilon = step.epsilon_L != null ? step.epsilon_L : DEFAULT_EPSILON;
    const margin = step.margin != null ? step.margin : DEFAULT_MARGIN;

    // PSG-3: Stable → Mutation must have explicit cause
    if (from === "Stable" && to === "Mutation") {
      const hasHighDrift = drift > epsilon + margin;
      const hasCgFail = !cgOk;
      if (!hasHighDrift && !hasCgFail) {
        violations.push(
          `PSG-3 step ${i}: Stable→Mutation without cause ` +
            `(drift=${drift}, cg_ok=${cgOk})`
        );
      }
    }
  }

  // Check expected trajectory (if provided)
  if (traj.expect_regions) {
    for (let i = 0; i < traj.expect_regions.length; i++) {
      if (regions[i] !== traj.expect_regions[i]) {
        violations.push(
          `Trajectory step ${i}: expected ${traj.expect_regions[i]}, got ${regions[i]}`
        );
      }
    }
  }

  const ok = violations.length === 0;
  if (!ok) allPass = false;

  console.log(ok ? `PASS [${trajName}]` : `FAIL [${trajName}]`);
  violations.forEach((v) => console.log(`      → ${v}`));

  allResults.push({ name: trajName, regions, ok, violations });
});

/* ──────────────────────────────────────────────────────────── */
/*  EPSILON SWEEP TESTS (parameterized phase diagram)           */
/* ──────────────────────────────────────────────────────────── */

const sweepCases = data.epsilon_sweep_cases || [];

sweepCases.forEach((sw) => {
  const name = sw.name || "unnamed-sweep";
  const drift = sw.drift;
  const cgOk = sw.cg_ok;
  const margin = sw.margin != null ? sw.margin : DEFAULT_MARGIN;
  const sweepValues = sw.epsilon_values || [];
  const expectedRegions = sw.expect_regions || [];

  const violations = [];
  const computedRegions = [];

  sweepValues.forEach((eps, i) => {
    const region = classifyRegion(drift, cgOk, eps, margin);
    computedRegions.push(region);

    if (expectedRegions[i] && region !== expectedRegions[i]) {
      violations.push(
        `ε_L=${eps}: expected ${expectedRegions[i]}, got ${region}`
      );
    }
  });

  const ok = violations.length === 0;
  if (!ok) allPass = false;

  console.log(ok ? `PASS [${name}]` : `FAIL [${name}]`);
  violations.forEach((v) => console.log(`      → ${v}`));

  allResults.push({ name, computedRegions, ok });
});

/* ──────────────────────────────────────────────────────────── */
/*  DETERMINISM CHECK                                           */
/* ──────────────────────────────────────────────────────────── */

let deterministicOk = true;

// Re-run single-step
let idx = 0;
singleCases.forEach((c) => {
  const drift = c.features.law_drift_algebra;
  const cgOk = c.features.cg_ok;
  const epsilon = c.epsilon_L != null ? c.epsilon_L : DEFAULT_EPSILON;
  const margin = c.margin != null ? c.margin : DEFAULT_MARGIN;

  const region2 = classifyRegion(drift, cgOk, epsilon, margin);
  const cause2 = classifyCause(drift, cgOk, epsilon, margin);
  const action2 = governanceAction(region2, cause2);

  if (
    region2 !== allResults[idx].region ||
    action2 !== allResults[idx].action
  ) {
    deterministicOk = false;
    console.log(`FAIL [DETERMINISM] — non-deterministic: ${c.name}`);
  }
  idx++;
});

// Re-run trajectories (with absorbing-state enforcement, same as main run)
trajectories.forEach((traj) => {
  const steps = traj.steps || [];
  const recoveryAllowed2 =
    traj.recovery_allowed != null ? traj.recovery_allowed : RECOVERY_ALLOWED;
  const recoveryK2 = traj.recovery_k != null ? traj.recovery_k : RECOVERY_K;

  const regions2 = [];
  let inMut2 = false;
  let recCtr2 = 0;

  steps.forEach((s) => {
    const epsilon = s.epsilon_L != null ? s.epsilon_L : DEFAULT_EPSILON;
    const margin = s.margin != null ? s.margin : DEFAULT_MARGIN;
    const raw = classifyRegion(
      s.features.law_drift_algebra,
      s.features.cg_ok,
      epsilon,
      margin
    );
    if (inMut2) {
      if (recoveryAllowed2) {
        const d = s.features.law_drift_algebra;
        const c = s.features.cg_ok;
        if (d < epsilon - margin && c) recCtr2++;
        else recCtr2 = 0;
        if (recCtr2 >= recoveryK2 && raw === "Stable") {
          inMut2 = false;
          recCtr2 = 0;
          regions2.push(raw);
        } else {
          regions2.push("Mutation");
        }
      } else {
        regions2.push("Mutation");
      }
    } else {
      regions2.push(raw);
      if (raw === "Mutation") { inMut2 = true; recCtr2 = 0; }
    }
  });

  const stored = allResults[idx];
  if (stored && stored.regions) {
    for (let i = 0; i < regions2.length; i++) {
      if (regions2[i] !== stored.regions[i]) {
        deterministicOk = false;
        console.log(
          `FAIL [DETERMINISM] — non-deterministic trajectory: ${traj.name} step ${i}`
        );
      }
    }
  }
  idx++;
});

if (deterministicOk) {
  console.log("PASS [DETERMINISM]");
} else {
  allPass = false;
}

/* ── Summary ──────────────────────────────────────────────── */

console.log("");
if (!allPass) {
  console.log("FAIL: PSG-VTS v1.0 — violations detected.\n");
  process.exit(2);
}

console.log("PASS: PSG-VTS v1.0 — Phase Space Geometry validated.\n");
process.exit(0);
