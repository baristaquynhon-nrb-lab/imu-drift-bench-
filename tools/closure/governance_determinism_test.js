#!/usr/bin/env node
// tools/closure/governance_determinism_test.js
"use strict";

const fs = require("fs");

function fail(msg, extra) {
  console.error("FAIL:", msg);
  if (extra) console.error(extra);
  process.exit(2);
}
function refuse(msg) {
  console.error("REFUSE:", msg);
  process.exit(3);
}

/**
 * Deterministic governance operator (bench policy).
 * NOTE: In CAS, this MUST be replaced by the normative LGO policy pack.
 * Here we validate determinism + expected action mapping for test vectors.
 */
function decideAction(f) {
  const region = f.topology_region;

  // Hard guards: if any metric missing, refuse upstream (but here treat as FAIL)
  if (!region) return "INVALID";

  if (region === "Stable") return "NOOP";
  if (region === "Transition") return "PATCH";
  // Mutation => FORK as default conservative action
  if (region === "Mutation") return "FORK";

  return "INVALID";
}

function run() {
  const p = process.argv[2];
  if (!p) refuse("Usage: node tools/closure/governance_determinism_test.js <governance_cases.json>");
  if (!fs.existsSync(p)) refuse(`missing ${p}`);

  let obj;
  try { obj = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { refuse("governance_cases.json parse error"); }

  const cases = (obj && obj.cases) || [];
  if (!Array.isArray(cases) || cases.length === 0) refuse("missing cases[]");

  const failures = [];

  for (const c of cases) {
    const f = c.features || {};
    const expected = c.expected_action;
    const a1 = decideAction(f);
    const a2 = decideAction(f);
    const a3 = decideAction(f);

    const okRepeat = (a1 === a2) && (a2 === a3);
    const okExpected = (a1 === expected);

    if (!okRepeat || !okExpected) {
      failures.push({
        name: c.name || "(unnamed)",
        expected,
        got: a1,
        repeat_ok: okRepeat,
        expected_ok: okExpected,
        features: f
      });
    }
  }

  if (failures.length) {
    fail("Governance Determinism Test (GDT) failed", failures);
  }

  console.log(`PASS: Governance Determinism Test (GDT) (${cases.length}/${cases.length} cases).`);
  process.exit(0);
}

run();
