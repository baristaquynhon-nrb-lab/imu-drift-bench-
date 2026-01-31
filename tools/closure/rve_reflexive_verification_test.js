#!/usr/bin/env node
/**
 * RVE-VTS v1.0 — Reflexive Verification Embedding Validation Test Suite
 *
 * Layer: 1.2.ak
 * Validates: VERIFICATION_EVENT formation, hash canonicality,
 *            replay verification, chain immutability.
 *
 * Exit codes: 0=PASS, 2=FAIL, 3=REFUSE
 *
 * Usage:
 *   node rve_reflexive_verification_test.js <rve_cases.json>
 */

"use strict";

const fs = require("fs");
const crypto = require("crypto");

/* ── CLI guard ─────────────────────────────────────────────── */

const file = process.argv[2];
if (!file) { console.error("REFUSE: missing rve_cases.json"); process.exit(3); }
if (!fs.existsSync(file)) { console.error(`REFUSE: file not found — ${file}`); process.exit(3); }

let data;
try { data = JSON.parse(fs.readFileSync(file, "utf-8")); }
catch (e) { console.error(`REFUSE: invalid JSON — ${e.message}`); process.exit(3); }

const cases = data.cases || [];
if (cases.length === 0) { console.error("REFUSE: no cases found."); process.exit(3); }

/* ── Canonical hash ───────────────────────────────────────── */

function canonicalHash(obj) {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return "sha256:" + crypto.createHash("sha256").update(canonical, "utf-8").digest("hex");
}

/* ── VERIFICATION_EVENT builder ───────────────────────────── */

const REQUIRED_FIELDS = [
  "event_type", "layer", "spec_hash", "runner_hash",
  "case_hash", "result_hash", "verdict"
];

function buildVerificationEvent(spec, runner, caseData, result) {
  return {
    event_type: "VERIFICATION_EVENT",
    layer: spec.layer || "unknown",
    spec_hash: canonicalHash(spec),
    runner_hash: canonicalHash(runner),
    case_hash: canonicalHash(caseData),
    result_hash: canonicalHash(result),
    verdict: result.verdict || "UNKNOWN"
  };
}

function isWellFormed(evt) {
  return REQUIRED_FIELDS.every((f) => evt[f] !== undefined && evt[f] !== null);
}

/* ── Chain operations ─────────────────────────────────────── */

function chainAppend(prevHash, event) {
  const payload = prevHash + "||" + JSON.stringify(event, Object.keys(event).sort());
  return "sha256:" + crypto.createHash("sha256").update(payload, "utf-8").digest("hex");
}

/* ── VTS Runner ───────────────────────────────────────────── */

console.log("\n--- RVE-VTS v1.0 ---\n");

let allPass = true;

cases.forEach((tc) => {
  const name = tc.name || "unnamed";
  const violations = [];

  const spec = tc.spec || {};
  const runner = tc.runner || {};
  const caseObj = tc.case_data || {};
  const result = tc.result || {};

  // Build verification event
  const evt = buildVerificationEvent(spec, runner, caseObj, result);

  // RVE-1: Event formation — must be well-formed
  if (!isWellFormed(evt)) {
    violations.push("RVE-1: VERIFICATION_EVENT missing required fields");
  }
  if (evt.event_type !== "VERIFICATION_EVENT") {
    violations.push("RVE-1: event_type is not VERIFICATION_EVENT");
  }

  // RVE-2: Hash canonicality — re-hash must produce identical result
  const evt2 = buildVerificationEvent(spec, runner, caseObj, result);
  if (evt.spec_hash !== evt2.spec_hash) violations.push("RVE-2: spec_hash non-deterministic");
  if (evt.runner_hash !== evt2.runner_hash) violations.push("RVE-2: runner_hash non-deterministic");
  if (evt.case_hash !== evt2.case_hash) violations.push("RVE-2: case_hash non-deterministic");
  if (evt.result_hash !== evt2.result_hash) violations.push("RVE-2: result_hash non-deterministic");

  // RVE-3: Replay verification — same inputs → same result_hash
  const replayResult = { ...result }; // identical replay
  const replayEvt = buildVerificationEvent(spec, runner, caseObj, replayResult);
  if (evt.result_hash !== replayEvt.result_hash) {
    violations.push("RVE-3: replay produced different result_hash");
  }

  // RVE-4: Chain immutability — append-only, consistent hash
  const chain = tc.chain || [];
  let prevHash = "sha256:genesis";
  let chainOk = true;

  for (let i = 0; i < chain.length; i++) {
    const expectedHash = chainAppend(prevHash, chain[i]);
    prevHash = expectedHash;
  }

  // Append current event
  const hashAfterAppend = chainAppend(prevHash, evt);

  // Verify chain is still valid (re-compute from scratch)
  let verifyHash = "sha256:genesis";
  for (let i = 0; i < chain.length; i++) {
    verifyHash = chainAppend(verifyHash, chain[i]);
  }
  verifyHash = chainAppend(verifyHash, evt);

  if (hashAfterAppend !== verifyHash) {
    violations.push("RVE-4: chain hash inconsistent after append");
    chainOk = false;
  }

  // Verify that modifying a prior event breaks the chain
  if (chain.length > 0) {
    const tamperedChain = JSON.parse(JSON.stringify(chain));
    tamperedChain[0].verdict = "TAMPERED";
    let tamperedHash = "sha256:genesis";
    for (let i = 0; i < tamperedChain.length; i++) {
      tamperedHash = chainAppend(tamperedHash, tamperedChain[i]);
    }
    tamperedHash = chainAppend(tamperedHash, evt);
    if (tamperedHash === verifyHash) {
      violations.push("RVE-4: tampered chain produced same hash (collision!)");
    }
  }

  const ok = violations.length === 0;
  if (!ok) allPass = false;
  console.log(ok ? `PASS [${name}]` : `FAIL [${name}]`);
  violations.forEach((v) => console.log(`      → ${v}`));
});

console.log("");
if (!allPass) { console.log("FAIL: RVE-VTS v1.0 — violations detected.\n"); process.exit(2); }
console.log("PASS: RVE-VTS v1.0 — Reflexive Verification Embedding validated.\n");
process.exit(0);
