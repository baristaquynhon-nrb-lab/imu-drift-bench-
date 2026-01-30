#!/usr/bin/env node
/**
 * CLP REPLAY TOPOLOGY VERIFIER — L4+ FULL EPISTEMIC CLOSURE
 *
 * Verifies forensic reproducibility for:
 *   LEAE → LSTI → LDTM → LDBC  (+ LSI algebra binding)
 *
 * Requirements:
 *  - sessions/<session>/input_bundle.json
 *  - sessions/<session>/clp_ledger_append.jsonl
 *  - sessions/<session>/clp_hash_head.txt (recommended)
 *
 * It will:
 *  1) Read ledger events (JSONL)
 *  2) Verify chain continuity (prevHash/hash) using canonical decision hashing
 *  3) Select latest event with test_type = "CAS_FULL_EPISTEMIC_TOPOLOGY"
 *  4) Recompute:
 *        - input_hash
 *        - topology_trace
 *        - topology_hash
 *        - LSI(last)
 *        - law_drift_algebra(last)
 *        - topology_drift(last)
 *        - topology_region(last)
 *  5) Cross-check all invariants against the CLP event
 *  6) Emit sessions/<session>/topology_replay_verify.json
 *
 * Exit codes:
 *  0 = PASS
 *  2 = FAIL (mismatch / chain break / invariant violated)
 *  3 = REFUSE (missing inputs / usage)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(x) {
  return crypto.createHash("sha256").update(x).digest("hex");
}

/**
 * Deterministic canonical JSON stringify (MUST match session runner).
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

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readLines(p) {
  return fs
    .readFileSync(p, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
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

/** ---------------- Deterministic Topology Pipeline (MUST match runner) ---------------- **/

function LEAE(law) {
  return [law.coverage, law.consistency, law.alignment];
}

function LSTI(S) {
  return S;
}

function computeLSI(S) {
  return (S[0] + S[1] + S[2]) / 3;
}

function classifyTopology(drift) {
  if (drift < 0.05) return "Stable";
  if (drift < 0.25) return "Transition";
  return "Mutation";
}

function rebuildTopologyTrace(inputBundle) {
  if (
    !inputBundle ||
    !Array.isArray(inputBundle.law_states) ||
    inputBundle.law_states.length === 0
  ) {
    throw new Error("INVALID_INPUT_BUNDLE: missing law_states[]");
  }

  const topology_trace = [];
  let prevX = null;
  let prevS = null;

  for (let i = 0; i < inputBundle.law_states.length; i++) {
    const S = LEAE(inputBundle.law_states[i]);
    const X = LSTI(S);
    const LSI = computeLSI(S);

    let topology_drift = 0;
    let topology_region = "GENESIS";
    let law_drift_algebra = 0;

    if (prevX) {
      topology_drift = norm(prevX, X);
      topology_region = classifyTopology(topology_drift);
    }

    if (prevS) {
      law_drift_algebra = norm(prevS, S);
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

  return topology_trace;
}

/** ---------------- CLP Verification ---------------- **/

function parseJSONL(p) {
  const lines = readLines(p);
  return lines.map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`LEDGER_PARSE_ERROR line=${idx + 1}`);
    }
  });
}

function verifyCLPChain(events, headFromFileOrNull = null) {
  let lastHash = null;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e || typeof e !== "object") {
      return { ok: false, reason: "EVENT_NOT_OBJECT", i };
    }

    const { prevHash, hash, ...decision } = e;

    if (!prevHash || !hash) {
      return { ok: false, reason: "MISSING_prevHash_or_hash", i };
    }

    const recomputed = sha256(stableStringify(decision) + prevHash);

    if (recomputed !== hash) {
      return {
        ok: false,
        reason: "HASH_MISMATCH",
        i,
        expected: recomputed,
        got: hash
      };
    }

    if (i > 0 && prevHash !== lastHash) {
      return {
        ok: false,
        reason: "CHAIN_BREAK_prevHash_not_equal_lastHash",
        i,
        prevHash,
        lastHash
      };
    }

    lastHash = hash;
  }

  if (headFromFileOrNull && lastHash && headFromFileOrNull !== lastHash) {
    return { ok: false, reason: "HEAD_MISMATCH", expected: lastHash, got: headFromFileOrNull };
  }

  return { ok: true, lastHash };
}

function pickLatestFullEpistemicEvent(events) {
  const matches = events.filter((e) => e && e.test_type === "CAS_FULL_EPISTEMIC_TOPOLOGY");
  if (matches.length === 0) return null;
  return matches[matches.length - 1];
}

function nearlyEqual(a, b, eps = 1e-12) {
  if (a === null || a === undefined) return a === b;
  if (b === null || b === undefined) return a === b;
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  return Math.abs(a - b) <= eps;
}

function run() {
  const session = process.argv[2];
  if (!session) {
    console.error("Usage: node clp_replay_topology_verifier.js <session>");
    process.exit(3);
  }

  const dir = path.join("sessions", session);

  const inputPath = path.join(dir, "input_bundle.json");
  const ledgerPath = path.join(dir, "clp_ledger_append.jsonl");
  const headPath = path.join(dir, "clp_hash_head.txt");

  if (!fs.existsSync(inputPath)) {
    console.error("REFUSE: missing input_bundle.json at", inputPath);
    process.exit(3);
  }
  if (!fs.existsSync(ledgerPath)) {
    console.error("REFUSE: missing clp_ledger_append.jsonl at", ledgerPath);
    process.exit(3);
  }

  const head = fs.existsSync(headPath) ? fs.readFileSync(headPath, "utf8").trim() : null;

  // 1) Read ledger
  const events = parseJSONL(ledgerPath);
  if (events.length === 0) {
    console.error("FAIL: ledger empty");
    process.exit(2);
  }

  // 2) Verify chain integrity + head
  const chain = verifyCLPChain(events, head);
  if (!chain.ok) {
    console.error("FAIL: CLP chain invalid:", chain);
    process.exit(2);
  }

  // 3) Pick latest full-epistemic event
  const ev = pickLatestFullEpistemicEvent(events);
  if (!ev) {
    console.error('FAIL: no event with test_type="CAS_FULL_EPISTEMIC_TOPOLOGY" found');
    process.exit(2);
  }

  // 4) Rebuild deterministically from input bundle
  const input = readJSON(inputPath);

  const recomputed_input_hash = sha256(stableStringify(input));
  const topology_trace = rebuildTopologyTrace(input);
  const recomputed_topology_hash = sha256(stableStringify(topology_trace));

  const last = topology_trace[topology_trace.length - 1];

  // 5) Cross-check invariants
  const checks = [];

  // Evidence anchors
  checks.push({
    name: "input_hash",
    ok: ev.input_hash === recomputed_input_hash,
    expected: recomputed_input_hash,
    got: ev.input_hash
  });

  // Topology hash
  checks.push({
    name: "topology_hash",
    ok: ev.topology_hash === recomputed_topology_hash,
    expected: recomputed_topology_hash,
    got: ev.topology_hash
  });

  // LSI + drifts + region (last-step binding)
  checks.push({
    name: "LSI(last)",
    ok: nearlyEqual(ev.LSI, last.LSI),
    expected: last.LSI,
    got: ev.LSI
  });

  checks.push({
    name: "law_drift_algebra(last)",
    ok: nearlyEqual(ev.law_drift_algebra, last.law_drift_algebra),
    expected: last.law_drift_algebra,
    got: ev.law_drift_algebra
  });

  checks.push({
    name: "topology_drift(last)",
    ok: nearlyEqual(ev.topology_drift, last.topology_drift),
    expected: last.topology_drift,
    got: ev.topology_drift
  });

  checks.push({
    name: "topology_region(last)",
    ok: ev.topology_region === last.topology_region,
    expected: last.topology_region,
    got: ev.topology_region
  });

  // Optional structural checks (vector equality via canonical)
  checks.push({
    name: "leae_S(last)",
    ok: stableStringify(ev.leae_S) === stableStringify(last.S),
    expected: last.S,
    got: ev.leae_S
  });

  checks.push({
    name: "topology_X(last)",
    ok: stableStringify(ev.topology_X) === stableStringify(last.X),
    expected: last.X,
    got: ev.topology_X
  });

  const allOk = checks.every((c) => c.ok);

  // Emit replay artifact
  const replayOut = {
    verdict: allOk ? "PASS" : "FAIL",
    session,
    clp_last_hash: chain.lastHash,
    checked_event_timestamp: ev.timestamp || null,
    invariants: checks,
    recomputed: {
      input_hash: recomputed_input_hash,
      topology_hash: recomputed_topology_hash
    }
  };

  writeJSON(path.join(dir, "topology_replay_verify.json"), replayOut);

  if (!allOk) {
    console.error("FAIL: full-epistemic replay mismatch");
    for (const c of checks.filter((x) => !x.ok)) {
      console.error(` - ${c.name} mismatch`);
    }
    process.exit(2);
  }

  console.log("PASS: CLP chain OK, full-epistemic replay OK");
  process.exit(0);
}

run();
