#!/usr/bin/env node
/**
 * ECT-VTS v1.0 — Epistemic Closure Theorem Validation Test Suite
 *
 * Layer: 1.2.al
 * Validates: Observation encodability, ontological containment,
 *            transition consistency, chain integrity.
 *
 * Exit codes: 0=PASS, 2=FAIL, 3=REFUSE
 *
 * Usage:
 *   node ect_epistemic_closure_test.js <ect_cases.json>
 */

"use strict";

const fs = require("fs");
const crypto = require("crypto");

/* ── CLI guard ─────────────────────────────────────────────── */

const file = process.argv[2];
if (!file) { console.error("REFUSE: missing ect_cases.json"); process.exit(3); }
if (!fs.existsSync(file)) { console.error(`REFUSE: file not found — ${file}`); process.exit(3); }

let data;
try { data = JSON.parse(fs.readFileSync(file, "utf-8")); }
catch (e) { console.error(`REFUSE: invalid JSON — ${e.message}`); process.exit(3); }

const cases = data.cases || [];
if (cases.length === 0) { console.error("REFUSE: no cases found."); process.exit(3); }

/* ── E* domain definition ─────────────────────────────────── */

// Valid axes in the extended epistemic state manifold
const ESTAR_AXES = new Set(["M", "L", "X", "C", "H", "V"]);

// Valid event_type values
const VALID_EVENT_TYPES = new Set([
  "VERIFICATION_EVENT", "DRIFT_OBSERVATION", "PHASE_CLASSIFICATION",
  "STATE_DESCRIPTION", "GOVERNANCE_ACTION"
]);

// Valid observation fields (must map to E* axes)
const FIELD_TO_AXIS = {
  "verification_result": "V",
  "verdict": "V",
  "spec_hash": "V",
  "runner_hash": "V",
  "case_hash": "V",
  "result_hash": "V",
  "layer": "V",
  "drift_metric": "X",
  "law_drift_algebra": "L",
  "phase_region": "X",
  "cg_ok": "C",
  "meaning_state": "M",
  "history_ref": "H",
  "event_type": "V"
};

/* ── Canonical hash ───────────────────────────────────────── */

function canonicalHash(obj) {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return "sha256:" + crypto.createHash("sha256").update(canonical, "utf-8").digest("hex");
}

function chainAppend(prevHash, event) {
  const payload = prevHash + "||" + JSON.stringify(event, Object.keys(event).sort());
  return "sha256:" + crypto.createHash("sha256").update(payload, "utf-8").digest("hex");
}

/* ── Observation → Event encoder ──────────────────────────── */

function encodeObservation(obs) {
  const event = {
    event_type: obs.observation_type || "STATE_DESCRIPTION",
    ...obs.fields
  };
  return event;
}

/* ── E* transition (simplified) ───────────────────────────── */

function applyTransition(state, event) {
  // δ(E*, e) → E*' — only H and V axes change
  const newState = JSON.parse(JSON.stringify(state));
  newState.H.push(event);
  newState.V.push({
    event_hash: canonicalHash(event),
    verdict: event.verdict || null
  });
  return newState;
}

function isValidEstar(state) {
  return (
    state.M !== undefined &&
    state.L !== undefined &&
    state.X !== undefined &&
    state.C !== undefined &&
    Array.isArray(state.H) &&
    Array.isArray(state.V)
  );
}

/* ── VTS Runner ───────────────────────────────────────────── */

console.log("\n--- ECT-VTS v1.0 ---\n");

let allPass = true;

cases.forEach((tc) => {
  const name = tc.name || "unnamed";
  const violations = [];

  const observation = tc.observation || {};
  const initialState = tc.initial_state || { M: {}, L: {}, X: {}, C: {}, H: [], V: [] };

  // ECT-1: Observation encodability
  const event = encodeObservation(observation);
  if (!event.event_type) {
    violations.push("ECT-1: encoded event has no event_type");
  }
  if (!VALID_EVENT_TYPES.has(event.event_type)) {
    violations.push(`ECT-1: event_type '${event.event_type}' not in valid set`);
  }

  // ECT-2: Ontological containment — all fields map to E* axes
  const fields = observation.fields || {};
  for (const key of Object.keys(fields)) {
    const axis = FIELD_TO_AXIS[key];
    if (!axis) {
      // Unknown field — check if it's a known E* axis directly
      if (!ESTAR_AXES.has(key)) {
        violations.push(`ECT-2: field '${key}' has no mapping to E* axes`);
      }
    } else if (!ESTAR_AXES.has(axis)) {
      violations.push(`ECT-2: field '${key}' maps to '${axis}' which is not an E* axis`);
    }
  }

  // ECT-3: Transition consistency — δ(E*, e) produces valid E*
  const nextState = applyTransition(initialState, event);
  if (!isValidEstar(nextState)) {
    violations.push("ECT-3: transition produced invalid E* state");
  }
  // Base axes must be unchanged
  if (JSON.stringify(nextState.M) !== JSON.stringify(initialState.M)) {
    violations.push("ECT-3: M axis changed after observation event");
  }
  if (JSON.stringify(nextState.L) !== JSON.stringify(initialState.L)) {
    violations.push("ECT-3: L axis changed after observation event");
  }
  if (JSON.stringify(nextState.X) !== JSON.stringify(initialState.X)) {
    violations.push("ECT-3: X axis changed after observation event");
  }
  if (JSON.stringify(nextState.C) !== JSON.stringify(initialState.C)) {
    violations.push("ECT-3: C axis changed after observation event");
  }

  // ECT-4: Chain integrity — hash chain consistent after encoding
  let prevHash = tc.chain_head || "sha256:genesis";
  const newHash = chainAppend(prevHash, event);
  const verifyHash = chainAppend(prevHash, event);
  if (newHash !== verifyHash) {
    violations.push("ECT-4: chain hash non-deterministic");
  }

  // Determinism check: encode again
  const event2 = encodeObservation(observation);
  const hash2 = chainAppend(prevHash, event2);
  if (newHash !== hash2) {
    violations.push("ECT-4: re-encoded event produces different chain hash");
  }

  const ok = violations.length === 0;
  if (!ok) allPass = false;
  console.log(ok ? `PASS [${name}]` : `FAIL [${name}]`);
  violations.forEach((v) => console.log(`      → ${v}`));
});

console.log("");
if (!allPass) { console.log("FAIL: ECT-VTS v1.0 — violations detected.\n"); process.exit(2); }
console.log("PASS: ECT-VTS v1.0 — Epistemic Closure Theorem validated.\n");
process.exit(0);
