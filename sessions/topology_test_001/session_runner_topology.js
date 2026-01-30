#!/usr/bin/env node
/**
 * LAW–TOPOLOGY CONSISTENCY VALIDATION SESSION (L4+ FULL EPISTEMIC)
 * Validates: LEAE → LSTI → LDTM → LDBC chain
 * Persists: topology_trace.json + result.json
 * Binds: CLP append-only ledger with FULL epistemic payload:
 *   - input_hash
 *   - LEAE algebra state + LSI
 *   - algebra drift
 *   - topology drift + region
 *   - topology_hash
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

/** ---------------- Deterministic Topology Pipeline ---------------- **/

// LEAE: law -> algebraic state S (vector)
function LEAE(law) {
  return [law.coverage, law.consistency, law.alignment];
}

// LSTI: embed S into topological coordinate x in R^3
function LSTI(S) {
  return S;
}

// LSI: law stability index derived from algebraic invariants (simple profile for this bench)
function computeLSI(S) {
  return (S[0] + S[1] + S[2]) / 3;
}

// LDBC: boundary semantics based on drift magnitude
function classifyTopology(drift) {
  if (drift < 0.05) return "Stable";
  if (drift < 0.25) return "Transition";
  return "Mutation";
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

  // Forensic anchor: input hash (canonical)
  const input_hash = sha256(stableStringify(input));

  const topology_trace = [];

  let prevX = null;
  let prevS = null;

  let continuityPass = true;

  for (let i = 0; i < input.law_states.length; i++) {
    const S = LEAE(input.law_states[i]); // Algebra
    const X = LSTI(S);                   // Embedding

    const LSI = computeLSI(S);

    let topology_drift = 0;
    let topology_region = "GENESIS";

    let law_drift_algebra = 0;

    if (prevX) {
      topology_drift = norm(prevX, X);
      topology_region = classifyTopology(topology_drift);
      // continuity constraint (bench-specific): any absurd jump is a FAIL
      if (topology_drift > 1.0) continuityPass = false;
    }

    if (prevS) {
      law_drift_algebra = norm(prevS, S);
      // Optional: also enforce bounded algebra motion (bench-specific)
      if (law_drift_algebra > 1.0) continuityPass = false;
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
  }

  // Persist trace
  const tracePath = path.join(dir, "topology_trace.json");
  writeJSON(tracePath, topology_trace);

  // Deterministic trace hash (canonical)
  const topology_hash = sha256(stableStringify(topology_trace));

  const verdict = continuityPass ? "PASS" : "FAIL";

  // Persist non-CLP result artifact (kept for convenience)
  const resultPath = path.join(dir, "result.json");
  writeJSON(resultPath, { verdict, topology_hash });

  // ================== CLP BINDING (L4+ FULL EPISTEMIC) ==================
  const ledgerPath = path.join(dir, "clp_ledger_append.jsonl");
  const hashHeadPath = path.join(dir, "clp_hash_head.txt");

  const last = topology_trace[topology_trace.length - 1];

  const decision = {
    // --- meta ---
    timestamp: new Date().toISOString(),
    test_type: "CAS_FULL_EPISTEMIC_TOPOLOGY",
    profile: "LEAE_LSTI_LDTM_LDBC_CLP_REPLAY",
    session,

    // --- verdict ---
    verdict,

    // --- coherence tuple (CG/CLP) ---
    MSI: null,                 // not evaluated in this bench
    LSI: last ? last.LSI : null,
    LMC: "TOPOLOGY_VALIDATION", // bench label; in full CAS this is numeric or structured

    // --- evidence anchors ---
    input_hash,

    // --- algebra (LEAE) ---
    leae_S: last ? last.S : null,
    law_drift_algebra: last ? last.law_drift_algebra : null,

    // --- topology (LSTI/LDTM/LDBC) ---
    topology_X: last ? last.X : null,
    topology_drift: last ? last.topology_drift : null,
    topology_region: last ? last.topology_region : null,
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

  console.log("SESSION RESULT:", verdict);
  console.log("TOPOLOGY HASH :", topology_hash);
  console.log("INPUT HASH    :", input_hash);
  console.log("CLP HASH HEAD :", newHash);

  process.exit(verdict === "PASS" ? 0 : 2);
}

run();
