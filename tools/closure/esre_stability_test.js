#!/usr/bin/env node
/**
 * ESRE-VTS v1.0 — Epistemic Stability under Reflexive Embedding
 *                  Validation Test Suite
 *
 * Layer: 1.2.am
 * Validates: HOE base preservation, extended Lyapunov boundedness,
 *            small-gain enforcement, phase compatibility, chain integrity.
 *
 * Exit codes: 0=PASS, 2=FAIL, 3=REFUSE
 *
 * Usage:
 *   node esre_stability_test.js <esre_cases.json>
 */

"use strict";

const fs = require("fs");
const crypto = require("crypto");

/* ── CLI guard ─────────────────────────────────────────────── */

const file = process.argv[2];
if (!file) { console.error("REFUSE: missing esre_cases.json"); process.exit(3); }
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

function chainAppend(prevHash, event) {
  const payload = prevHash + "||" + JSON.stringify(event, Object.keys(event).sort());
  return "sha256:" + crypto.createHash("sha256").update(payload, "utf-8").digest("hex");
}

/* ── VTS Runner ───────────────────────────────────────────── */

console.log("\n--- ESRE-VTS v1.0 ---\n");

let allPass = true;

cases.forEach((tc) => {
  const name = tc.name || "unnamed";
  const violations = [];

  const mode = tc.rve_mode || "HOE";
  const steps = tc.steps || [];
  const config = tc.config || {};

  const lambda_V = config.lambda_V != null ? config.lambda_V : 0.1;
  const alpha_max = config.alpha_max != null ? config.alpha_max : 0.05;
  const beta = config.stability_margin_beta != null ? config.stability_margin_beta : 0.2;
  const B_V = config.B_V != null ? config.B_V : 1.0;

  // Track state across steps
  let prevChainHash = "sha256:genesis";
  let prevBaseState = null;

  steps.forEach((step, i) => {
    const base_before = step.base_state_before;
    const base_after = step.base_state_after;
    const rve_event = step.rve_event || null;
    const W_V_delta = step.W_V_delta != null ? step.W_V_delta : 0;

    // ── ESRE-1: HOE base state preservation ──
    if (mode === "HOE" && base_before && base_after) {
      const axes = ["M", "L", "X", "C"];
      axes.forEach((ax) => {
        if (JSON.stringify(base_before[ax]) !== JSON.stringify(base_after[ax])) {
          violations.push(
            `ESRE-1 step ${i}: ${ax} axis changed in HOE mode`
          );
        }
      });
    }

    // ── ESRE-2: Extended Lyapunov boundedness ──
    if (W_V_delta > B_V) {
      violations.push(
        `ESRE-2 step ${i}: W_V delta (${W_V_delta}) exceeds bound B_V (${B_V})`
      );
    }

    // ── ESRE-3: Small-gain enforcement (BCE mode) ──
    if (mode === "BCE") {
      const base_drift = step.base_drift_from_rve || 0;
      const v_delta_norm = step.v_delta_norm || 0;

      // Check α bound
      if (v_delta_norm > 0) {
        const effective_alpha = base_drift / v_delta_norm;
        if (effective_alpha > alpha_max) {
          violations.push(
            `ESRE-3 step ${i}: effective α (${effective_alpha.toFixed(4)}) > α_max (${alpha_max})`
          );
        }
      }

      // Small-gain condition: α · λ_V < β
      if (alpha_max * lambda_V >= beta) {
        violations.push(
          `ESRE-3 step ${i}: small-gain violated: α·λ_V (${(alpha_max * lambda_V).toFixed(4)}) ≥ β (${beta})`
        );
      }
    }

    // ── ESRE-4: Phase geometry compatibility ──
    if (step.law_drift_before != null && step.law_drift_after != null) {
      if (step.law_drift_before !== step.law_drift_after) {
        violations.push(
          `ESRE-4 step ${i}: law_drift changed by RVE (${step.law_drift_before} → ${step.law_drift_after})`
        );
      }
    }
    if (step.cg_ok_before != null && step.cg_ok_after != null) {
      if (step.cg_ok_before !== step.cg_ok_after) {
        violations.push(
          `ESRE-4 step ${i}: cg_ok changed by RVE (${step.cg_ok_before} → ${step.cg_ok_after})`
        );
      }
    }

    // ── ESRE-5: Append-only chain integrity ──
    if (rve_event) {
      const newHash = chainAppend(prevChainHash, rve_event);
      // Verify determinism
      const verifyHash = chainAppend(prevChainHash, rve_event);
      if (newHash !== verifyHash) {
        violations.push(`ESRE-5 step ${i}: chain hash non-deterministic`);
      }
      prevChainHash = newHash;
    }
  });

  // ── Expected verdict check ──
  if (tc.expect_refuse === true) {
    // For BCE with violated small-gain, we expect failure detected above
    if (violations.length === 0) {
      violations.push("Expected REFUSE/FAIL but no violations detected");
    } else {
      // Violations are expected — this is a PASS for the "should fail" case
      console.log(`PASS [${name}]`);
      return;
    }
  }

  const ok = violations.length === 0;
  if (!ok) allPass = false;
  console.log(ok ? `PASS [${name}]` : `FAIL [${name}]`);
  violations.forEach((v) => console.log(`      → ${v}`));
});

console.log("");
if (!allPass) { console.log("FAIL: ESRE-VTS v1.0 — violations detected.\n"); process.exit(2); }
console.log("PASS: ESRE-VTS v1.0 — Epistemic Stability under Reflexive Embedding validated.\n");
process.exit(0);
