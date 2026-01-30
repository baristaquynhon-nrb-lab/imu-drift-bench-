#!/usr/bin/env node
/**
 * LAW–TOPOLOGY CONSISTENCY VALIDATION SESSION
 * Validates: LEAE → LSTI → LDTM → LDBC chain
 * Theorem: 1.2.ad Law–Topology Consistency Theorem
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(x) {
  return crypto.createHash("sha256").update(x).digest("hex");
}

function norm(a, b, w = [1, 1, 1]) {
  return Math.sqrt(
    w[0] * (a[0] - b[0]) ** 2 +
    w[1] * (a[1] - b[1]) ** 2 +
    w[2] * (a[2] - b[2]) ** 2
  );
}

// --- LEAE ---
function LEAE(law) {
  // Algebraic output S_t
  return [
    law.coverage,
    law.consistency,
    law.alignment
  ];
}

// --- LSTI ---
function LSTI(S) {
  // Embedding into R^3
  return S;
}

// --- LDBC ---
function classify(drift) {
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
  const input = JSON.parse(fs.readFileSync(path.join(dir, "input_bundle.json"), "utf8"));

  const ledger = [];
  let prevX = null;
  let continuityPass = true;

  for (let i = 0; i < input.law_states.length; i++) {
    const S = LEAE(input.law_states[i]);       // Algebra
    const X = LSTI(S);                         // Embedding

    let drift = 0;
    let region = "GENESIS";

    if (prevX) {
      drift = norm(prevX, X);
      region = classify(drift);
      if (drift > 1.0) continuityPass = false; // violation of bounded motion
    }

    ledger.push({ i, S, X, drift, region });
    prevX = X;
  }

  fs.writeFileSync(path.join(dir, "topology_trace.json"), JSON.stringify(ledger, null, 2));

  const verdict = continuityPass ? "PASS" : "FAIL";
  const hash = sha256(JSON.stringify(ledger));

  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ verdict, hash }, null, 2));

  // ================== CLP BINDING (L4 FORENSIC) ==================

  const ledgerPath = path.join(dir, "clp_ledger_append.jsonl");
  const hashHeadPath = path.join(dir, "clp_hash_head.txt");

  // CLP Decision Payload
  const decision = {
    timestamp: new Date().toISOString(),
    verdict,
    MSI: null,                // not evaluated in this test
    LSI: null,                // not evaluated here
    LMC: "TOPOLOGY_VALIDATION",
    topology_hash: hash,
    test_type: "LAW_TOPOLOGY_CONSISTENCY"
  };

  // Get previous hash
  let prevHash = "GENESIS";
  if (fs.existsSync(hashHeadPath)) {
    prevHash = fs.readFileSync(hashHeadPath, "utf8").trim();
  }

  // Canonical string
  const entryStr = JSON.stringify(decision) + prevHash;
  const newHash = sha256(entryStr);

  // Append to ledger
  fs.appendFileSync(ledgerPath, JSON.stringify({ ...decision, prevHash, hash: newHash }) + "\n");

  // Update head
  fs.writeFileSync(hashHeadPath, newHash);

  console.log("SESSION RESULT:", verdict);
  console.log("CLP HASH HEAD:", newHash);
  process.exit(verdict === "PASS" ? 0 : 2);
}

run();
