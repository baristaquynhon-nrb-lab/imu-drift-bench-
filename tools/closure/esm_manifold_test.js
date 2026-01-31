#!/usr/bin/env node
/**
 * ESM-VTS v1.0 — Epistemic State Manifold Validation Test Suite
 *
 * Validates Section 1.2.ae: every CLP event maps to a valid point
 * in the Epistemic State Manifold E = M x L x X x C x H.
 *
 * Tests:
 *   ESM-1  State Completeness (5 axes present)
 *   ESM-2  Manifold Coordinate Consistency (LSI, LSTI identity, MSI)
 *   ESM-3  Trajectory Validity (hash chain, no forks, no duplicates)
 *   ESM-4  Metric Continuity (drift values match topology classification)
 *   ESM-5  Historical Embedding (unique linear ordering)
 *
 * Input: <clp_ledger_append.jsonl> [clp_hash_head.txt]
 *
 * Exit codes:
 *   0 = PASS
 *   2 = FAIL
 *   3 = REFUSE (usage/missing inputs)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { stableStringify } = require("./stable_stringify");

function sha256(x) {
  return crypto.createHash("sha256").update(x).digest("hex");
}

function fail(testId, msg, detail) {
  console.error(`FAIL [${testId}]: ${msg}`);
  if (detail) console.error(detail);
  process.exit(2);
}

function refuse(msg) {
  console.error("REFUSE:", msg);
  process.exit(3);
}

function readLines(p) {
  return fs.readFileSync(p, "utf8")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseJSONL(p) {
  return readLines(p).map((line, idx) => {
    try { return JSON.parse(line); }
    catch (e) { throw new Error(`LEDGER_PARSE_ERROR line=${idx + 1}`); }
  });
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function nearlyEqual(a, b, eps) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return Math.abs(a - b) <= eps;
}

function arrNearlyEqual(a, b, eps) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => nearlyEqual(v, b[i], eps));
}

// ==================== ESM-1: State Completeness ====================
function testESM1(events) {
  const requiredFields = {
    M: ["meaning_state_hash", "MSI"],
    L: ["leae_S", "LSI"],
    X: ["topology_X", "topology_drift"],
    C: ["MSI", "LSI", "LMC"],
    H: ["hash", "prevHash"]
  };

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    for (const [axis, fields] of Object.entries(requiredFields)) {
      for (const f of fields) {
        if (e[f] === undefined || e[f] === null) {
          fail("ESM-1", `Event ${i} missing ${axis}-axis field: ${f}`);
        }
      }
    }
  }
  console.log(`PASS [ESM-1]: State Completeness (${events.length} events, all 5 axes present)`);
}

// ==================== ESM-2: Coordinate Consistency ====================
function testESM2(events) {
  const EPS = 1e-6;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    // LSI == mean(leae_S)
    const expectedLSI = mean(e.leae_S);
    if (!nearlyEqual(e.LSI, expectedLSI, EPS)) {
      fail("ESM-2", `Event ${i}: LSI mismatch`, { expected: expectedLSI, got: e.LSI });
    }

    // topology_X == leae_S (LSTI is identity in current bench)
    if (!arrNearlyEqual(e.topology_X, e.leae_S, EPS)) {
      fail("ESM-2", `Event ${i}: topology_X != leae_S (LSTI identity violated)`,
        { topology_X: e.topology_X, leae_S: e.leae_S });
    }

    // MSI consistency (in current bench, MSI == LSI because meaning_vec == leae_S)
    if (!nearlyEqual(e.MSI, expectedLSI, EPS)) {
      fail("ESM-2", `Event ${i}: MSI inconsistent with meaning vector`,
        { MSI: e.MSI, expected: expectedLSI });
    }
  }
  console.log(`PASS [ESM-2]: Manifold Coordinate Consistency (${events.length} events)`);
}

// ==================== ESM-3: Trajectory Validity ====================
function testESM3(events, headOrNull) {
  const hashes = new Set();
  let lastHash = null;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    // No duplicate hashes
    if (hashes.has(e.hash)) {
      fail("ESM-3", `Duplicate hash at event ${i}: ${e.hash}`);
    }
    hashes.add(e.hash);

    // Chain continuity
    if (i === 0) {
      // Genesis: prevHash should be "GENESIS" by convention
      if (!e.prevHash) {
        fail("ESM-3", `Event 0 missing prevHash`);
      }
    } else {
      if (e.prevHash !== lastHash) {
        fail("ESM-3", `Chain break at event ${i}`,
          { expected_prevHash: lastHash, got: e.prevHash });
      }
    }

    // Verify hash recomputation
    const { prevHash, hash, ...decision } = e;
    const recomputed = sha256(stableStringify(decision) + prevHash);
    if (recomputed !== hash) {
      fail("ESM-3", `Hash mismatch at event ${i}`,
        { expected: recomputed, got: hash });
    }

    lastHash = e.hash;
  }

  // Head file check
  if (headOrNull && lastHash && headOrNull !== lastHash) {
    fail("ESM-3", `Head mismatch`, { expected: lastHash, got: headOrNull });
  }

  console.log(`PASS [ESM-3]: Trajectory Validity (${events.length} events, chain intact, no forks)`);
}

// ==================== ESM-4: Metric Continuity ====================
function testESM4(events) {
  const EPS = 1e-6;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    // In current bench: topology_drift == law_drift_algebra (because LSTI is identity)
    if (!nearlyEqual(e.topology_drift, e.law_drift_algebra, EPS)) {
      fail("ESM-4", `Event ${i}: topology_drift != law_drift_algebra`,
        { topology_drift: e.topology_drift, law_drift_algebra: e.law_drift_algebra });
    }

    // meaning_drift should also equal topology_drift (bench: same vector space)
    if (e.meaning_drift !== undefined && e.meaning_drift !== null) {
      if (!nearlyEqual(e.meaning_drift, e.topology_drift, EPS)) {
        fail("ESM-4", `Event ${i}: meaning_drift != topology_drift`,
          { meaning_drift: e.meaning_drift, topology_drift: e.topology_drift });
      }
    }

    // Classification consistency
    if (e.topology_region === "Stable" && e.topology_drift >= 0.25) {
      fail("ESM-4", `Event ${i}: region=Stable but drift=${e.topology_drift} >= 0.25`);
    }
    if (e.topology_region === "Mutation" && e.topology_drift < 0.25) {
      fail("ESM-4", `Event ${i}: region=Mutation but drift=${e.topology_drift} < 0.25`);
    }
    if (e.topology_region === "Transition") {
      if (e.topology_drift < 0.05 || e.topology_drift >= 0.25) {
        fail("ESM-4", `Event ${i}: region=Transition but drift=${e.topology_drift} outside [0.05,0.25)`);
      }
    }
  }
  console.log(`PASS [ESM-4]: Metric Continuity (drift values match classification)`);
}

// ==================== ESM-5: Historical Embedding ====================
function testESM5(events) {
  // Check unique linear ordering via prevHash
  const prevHashes = events.map(e => e.prevHash);

  // No two events (except possibly index 0) share the same prevHash
  const seen = new Set();
  for (let i = 0; i < prevHashes.length; i++) {
    const ph = prevHashes[i];
    if (seen.has(ph)) {
      fail("ESM-5", `Fork detected: multiple events with prevHash=${ph}`);
    }
    seen.add(ph);
  }

  // All hashes are unique (already checked in ESM-3, but reinforce)
  const allHashes = events.map(e => e.hash);
  if (new Set(allHashes).size !== allHashes.length) {
    fail("ESM-5", `Non-unique hashes in chain`);
  }

  console.log(`PASS [ESM-5]: Historical Embedding (unique linear ordering, no forks)`);
}

// ==================== Main ====================
function run() {
  const ledgerPath = process.argv[2];
  if (!ledgerPath) {
    refuse("Usage: node tools/closure/esm_manifold_test.js <clp_ledger_append.jsonl> [clp_hash_head.txt]");
  }

  if (!fs.existsSync(ledgerPath)) {
    refuse(`missing ${ledgerPath}`);
  }

  const headPath = process.argv[3] || null;
  const head = (headPath && fs.existsSync(headPath))
    ? fs.readFileSync(headPath, "utf8").trim()
    : null;

  let events;
  try {
    events = parseJSONL(ledgerPath);
  } catch (e) {
    refuse(e.message);
  }

  if (events.length === 0) {
    fail("ESM-0", "Ledger is empty");
  }

  console.log(`--- ESM-VTS v1.0 --- (${events.length} events) ---`);

  testESM1(events);
  testESM2(events);
  testESM3(events, head);
  testESM4(events);
  testESM5(events);

  console.log(`PASS: ESM-VTS v1.0 — All 5 manifold tests passed. CAS operates as trajectory in E.`);
  process.exit(0);
}

run();
