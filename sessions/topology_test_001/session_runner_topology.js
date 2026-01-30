#!/usr/bin/env node
/**
 * LAW–TOPOLOGY CONSISTENCY VALIDATION SESSION (L4++ FULL CAS EPISTEMIC)
 *
 * Validates: LEAE → LSTI → LDTM → LDBC chain
 * Extends: Meaning-layer MSI binding into the same CLP event schema.
 *
 * Persists:
 *   - topology_trace.json
 *   - meaning_trace.json
 *   - result.json
 *
 * Binds: CLP append-only ledger with FULL CAS epistemic payload:
 *   - input_hash                      (law/topology input anchor)
 *   - meaning_input_hash              (meaning input anchor)
 *   - meaning_state_hash + MSI + meaning_drift
 *   - LEAE algebra state + LSI + algebra drift
 *   - topology drift + region + topology_hash
 *
 * Exit codes:
 *  0 = PASS
 *  2 = FAIL
 *  3 = REFUSE (usage/missing inputs)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(x) {
  return crypto.createHash("sha256").update(x).digest("hex");
}

/**
 * Deterministic canonical JSON stringify:
 * - Sorts object keys recursively
 * - Preserves array order
 * NOTE: Writer and verifier MUST use the same function.
 */
function stableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

function stableNormalize(v) {
  if (v === null || v === undefined) return v;
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(stableNormalize);

  const keys = Object.keys(v).sort();
  const out = {};
  for (const k of keys) out[k] = stableNormalize(v[k]);
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function norm(a, b, w = [1, 1, 1]) {
  return Math.sqrt(
    w[0] * (a[0] - b[0]) ** 2 +
      w[1] * (a[1] - b[1]) ** 2 +
      w[2] * (a[2] - b[2]) ** 2
  );
}

/** ---------------- Deterministic Law->Topology Pipeline ---------------- **/

// LEAE: law -> algebraic state S (vector)
function LEAE(law) {
  return [law.coverage, law.consistency, law.alignment];
}

// LSTI: embed S into topological coordinate x in R^3
function LSTI(S) {
  return S;
}

// LSI: law stability index derived from algebraic invariants (bench profile)
function computeLSI(S) {
  return (S[0] + S[1] + S[2]) / 3;
}

// LDBC: boundary semantics based on drift magnitude
function classifyTopology(drift) {
  if (drift < 0.05) return "Stable";
  if (drift < 0.25) return "Transition";
  return "Mutation";
}

/** ---------------- Deterministic Meaning Pipeline (MSI binding) ----------------
 *
 * This bench provides a deterministic "meaning extraction" from law_states
 * to a canonical meaning_state object, then derives:
 *   - meaning_state_hash
 *   - MSI (Meaning Stability Index)
 *   - meaning_drift (distance between last two meaning vectors)
 *
 * IMPORTANT:
 * - This is a bench-grade meaning proxy, NOT a full GSRA/NRB meaning runtime.
 * - Still: deterministic + replay-verifiable + evidence-anchored.
 */

// Deterministic meaning state derived from law state
function meaningStateFromLaw(law) {
  const vec = [law.coverage, law.consistency, law.alignment];

  const assertions = [];
  if (law.coverage >= 0.9) assertions.push("COVERAGE_HIGH");
  else if (law.coverage >= 0.8) assertions.push("COVERAGE_MED");
  else assertions.push("COVERAGE_LOW");

  if (law.consistency >= 0.85) assertions.push("CONSISTENCY_HIGH");
  else if (law.consistency >= 0.7) assertions.push("CONSISTENCY_MED");
  else assertions.push("CONSISTENCY_LOW");

  if (law.alignment >= 0.8) assertions.push("ALIGNMENT_HIGH");
  else if (law.alignment >= 0.65) assertions.push("ALIGNMENT_MED");
  else assertions.push("ALIGNMENT_LOW");

  return {
    meaning_vec: vec,
    meaning_assertions: assertions.sort() // stable ordering
  };
}

function computeMSI(meaningVec) {
  return (meaningVec[0] + meaningVec[1] + meaningVec[2]) / 3;
}

function run() {
  const session = process.argv[2];
  if (!session) {
    console.error("Usage: node session_runner_topology.js <session>");
    process.exit(3);
  }

  const dir = path.join("sessions", session);
  ensureDir(dir);

  const inputPath = path.join(dir, "input_bundle.json");
  if (!fs.existsSync(inputPath)) {
    console.error("REFUSE: missing input_bundle.json at", inputPath);
    process.exit(3);
  }

  const input = readJSON(inputPath);
  if (!input || !Array.isArray(input.law_states) || input.law_states.length === 0) {
    console.error("REFUSE: invalid input_bundle.json (missing law_states[])");
    process.exit(3);
  }

  // Forensic anchor: law/topology input hash (canonical)
  const input_hash = sha256(stableStringify(input));

  // Meaning input bundle (bench): derived deterministically from input
  const meaning_input_bundle = {
    source: "BENCH_PROXY",
    session,
    law_states: input.law_states
  };
  const meaning_input_hash = sha256(stableStringify(meaning_input_bundle));

  /** --------- Build topology trace --------- **/
  const topology_trace = [];
  let prevX = null;
  let prevS = null;

  /** --------- Build meaning trace --------- **/
  const meaning_trace = [];
  let prevMeaningVec = null;

  let continuityPass = true;

  for (let i = 0; i < input.law_states.length; i++) {
    // Law/Topology branch
    const S = LEAE(input.law_states[i]); // Algebra
    const X = LSTI(S);                   // Embedding
    const LSI = computeLSI(S);

    let topology_drift = 0;
    let topology_region = "GENESIS";
    let law_drift_algebra = 0;

    if (prevX) {
      topology_drift = norm(prevX, X);
      topology_region = classifyTopology(topology_drift);
      if (topology_drift > 1.0) continuityPass = false; // bench constraint
    }
    if (prevS) {
      law_drift_algebra = norm(prevS, S);
      if (law_drift_algebra > 1.0) continuityPass = false; // bench constraint
    }

    topology_trace.push({
      i,
      S,
      X,
      LSI,
      law_drift_algebra,
      topology_drift,
      topology_region
    });

    prevX = X;
    prevS = S;

    // Meaning branch (bench proxy)
    const ms = meaningStateFromLaw(input.law_states[i]); // deterministic meaning_state
    const MSI = computeMSI(ms.meaning_vec);

    let meaning_drift = 0;
    if (prevMeaningVec) {
      meaning_drift = norm(prevMeaningVec, ms.meaning_vec);
      if (meaning_drift > 1.0) continuityPass = false; // bench constraint
    }

    const meaning_state_hash = sha256(stableStringify(ms));

    meaning_trace.push({
      i,
      meaning_state: ms,
      meaning_state_hash,
      MSI,
      meaning_drift
    });

    prevMeaningVec = ms.meaning_vec;
  }

  // Persist traces
  writeJSON(path.join(dir, "topology_trace.json"), topology_trace);
  writeJSON(path.join(dir, "meaning_trace.json"), meaning_trace);

  // Deterministic hashes (canonical)
  const topology_hash = sha256(stableStringify(topology_trace));
  const meaning_trace_hash = sha256(stableStringify(meaning_trace));

  // Latest step bindings
  const lastTopo = topology_trace[topology_trace.length - 1] || null;
  const lastMeaning = meaning_trace[meaning_trace.length - 1] || null;

  // Verdict
  const verdict = continuityPass ? "PASS" : "FAIL";

  // Persist non-CLP result artifact (kept for convenience)
  writeJSON(path.join(dir, "result.json"), {
    verdict,
    input_hash,
    meaning_input_hash,
    topology_hash,
    meaning_trace_hash
  });

  // ================== CLP BINDING (L4++ FULL CAS EPISTEMIC) ==================
  const ledgerPath = path.join(dir, "clp_ledger_append.jsonl");
  const hashHeadPath = path.join(dir, "clp_hash_head.txt");

  const decision = {
    // --- meta ---
    timestamp: new Date().toISOString(),
    test_type: "CAS_FULL_EPISTEMIC_TOPOLOGY_MEANING",
    profile: "MEANING_LEAE_LSTI_LDTM_LDBC_CLP_REPLAY",
    session,

    // --- verdict ---
    verdict,

    // --- coherence tuple (CG/CLP) ---
    MSI: lastMeaning ? lastMeaning.MSI : null,
    LSI: lastTopo ? lastTopo.LSI : null,
    LMC: "TOPOLOGY_VALIDATION",

    // --- evidence anchors ---
    input_hash,
    meaning_input_hash,

    // --- meaning binding (replay-verifiable) ---
    meaning_state_hash: lastMeaning ? lastMeaning.meaning_state_hash : null,
    meaning_drift: lastMeaning ? lastMeaning.meaning_drift : null,
    meaning_trace_hash,

    // --- algebra binding (LEAE) ---
    leae_S: lastTopo ? lastTopo.S : null,
    law_drift_algebra: lastTopo ? lastTopo.law_drift_algebra : null,

    // --- topology binding (LSTI/LDTM/LDBC) ---
    topology_X: lastTopo ? lastTopo.X : null,
    topology_drift: lastTopo ? lastTopo.topology_drift : null,
    topology_region: lastTopo ? lastTopo.topology_region : null,
    topology_hash
  };

  // Get previous hash head (append-only chain)
  let prevHash = "GENESIS";
  if (fs.existsSync(hashHeadPath)) {
    prevHash = fs.readFileSync(hashHeadPath, "utf8").trim() || "GENESIS";
  }

  // Chain hash computed over canonical decision + prevHash
  const entryStr = stableStringify(decision) + prevHash;
  const newHash = sha256(entryStr);

  // Append JSONL event
  fs.appendFileSync(
    ledgerPath,
    JSON.stringify({ ...decision, prevHash, hash: newHash }) + "\n"
  );

  // Update head
  fs.writeFileSync(hashHeadPath, newHash);

  console.log("SESSION RESULT     :", verdict);
  console.log("INPUT HASH         :", input_hash);
  console.log("MEANING INPUT HASH :", meaning_input_hash);
  console.log("MEANING TRACE HASH :", meaning_trace_hash);
  console.log("TOPOLOGY HASH      :", topology_hash);
  console.log("CLP HASH HEAD      :", newHash);

  process.exit(verdict === "PASS" ? 0 : 2);
}

run();
