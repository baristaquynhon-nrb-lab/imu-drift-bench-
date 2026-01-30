#!/usr/bin/env node
/**
 * CLP REPLAY TOPOLOGY VERIFIER — L4 FORENSIC CLOSURE
 *
 * Verifies forensic reproducibility for:
 *   LEAE → LSTI → LDTM → LDBC
 *
 * Requirements:
 *  - sessions/<session>/input_bundle.json
 *  - sessions/<session>/clp_ledger_append.jsonl
 *  - sessions/<session>/clp_hash_head.txt   (optional but recommended)
 *
 * It will:
 *  1) Read ledger events (JSONL)
 *  2) Verify chain continuity (prevHash/hash)
 *  3) Select latest event with test_type = "LAW_TOPOLOGY_CONSISTENCY"
 *  4) Recompute topology_trace from input_bundle.json deterministically
 *  5) Hash recomputed trace and compare with event.topology_hash
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

function norm(a, b, w = [1, 1, 1]) {
  return Math.sqrt(
    w[0] * (a[0] - b[0]) ** 2 +
      w[1] * (a[1] - b[1]) ** 2 +
      w[2] * (a[2] - b[2]) ** 2
  );
}

/** ---------------- Deterministic Topology Pipeline ---------------- **/

// LEAE: law -> algebraic state S
function LEAE(law) {
  return [law.coverage, law.consistency, law.alignment];
}

// LSTI: embed S into topological coordinate x in R^3
function LSTI(S) {
  return S;
}

// LDBC: boundary semantics based on drift magnitude
function classify(drift) {
  if (drift < 0.05) return "Stable";
  if (drift < 0.25) return "Transition";
  return "Mutation";
}

// LDTM: build trajectory + drift fields
function rebuildTopologyTrace(inputBundle) {
  if (
    !inputBundle ||
    !Array.isArray(inputBundle.law_states) ||
    inputBundle.law_states.length === 0
  ) {
    throw new Error("INVALID_INPUT_BUNDLE: missing law_states[]");
  }

  const ledger = [];
  let prevX = null;

  for (let i = 0; i < inputBundle.law_states.length; i++) {
    const S = LEAE(inputBundle.law_states[i]);
    const X = LSTI(S);

    let drift = 0;
    let region = "GENESIS";

    if (prevX) {
      drift = norm(prevX, X);
      region = classify(drift);
    }

    ledger.push({ i, S, X, drift, region });
    prevX = X;
  }

  return ledger;
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

    if (!e || typeof e !== "object") return { ok: false, reason: "EVENT_NOT_OBJECT", i };

    const { prevHash, hash, ...decision } = e;

    if (!prevHash || !hash) return { ok: false, reason: "MISSING_prevHash_or_hash", i };

    const recomputed = sha256(JSON.stringify(decision) + prevHash);

    if (recomputed !== hash) {
      return {
        ok: false,
        reason: "HASH_MISMATCH",
        i,
        expected: recomputed,
        got: hash,
      };
    }

    // continuity check: prevHash should equal lastHash except genesis
    if (i > 0) {
      if (prevHash !== lastHash) {
        return {
          ok: false,
          reason: "CHAIN_BREAK_prevHash_not_equal_lastHash",
          i,
          prevHash,
          lastHash,
        };
      }
    }

    lastHash = hash;
  }

  if (headFromFileOrNull && lastHash && headFromFileOrNull !== lastHash) {
    return {
      ok: false,
      reason: "HEAD_MISMATCH",
      expected: lastHash,
      got: headFromFileOrNull,
    };
  }

  return { ok: true, lastHash };
}

function pickLatestTopologyEvent(events) {
  const matches = events.filter((e) => e && e.test_type === "LAW_TOPOLOGY_CONSISTENCY");
  if (matches.length === 0) return null;
  return matches[matches.length - 1];
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

  if (!fs.existsSync(inputPath)) {
    console.error("REFUSE: missing input_bundle.json at", inputPath);
    process.exit(3);
  }
  if (!fs.existsSync(ledgerPath)) {
    console.error("REFUSE: missing clp_ledger_append.jsonl at", ledgerPath);
    process.exit(3);
  }

  const headPath = path.join(dir, "clp_hash_head.txt");
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

  // 3) Pick latest topology event
  const topoEvent = pickLatestTopologyEvent(events);
  if (!topoEvent) {
    console.error("FAIL: no LAW_TOPOLOGY_CONSISTENCY event found in ledger");
    process.exit(2);
  }
  if (!topoEvent.topology_hash) {
    console.error("FAIL: topology event missing topology_hash");
    process.exit(2);
  }

  // 4) Rebuild trace deterministically from input bundle
  let rebuilt;
  try {
    const input = readJSON(inputPath);
    rebuilt = rebuildTopologyTrace(input);
  } catch (e) {
    console.error("FAIL:", e.message || String(e));
    process.exit(2);
  }

  // 5) Hash rebuilt trace and compare with recorded topology_hash
  const rebuiltHash = sha256(JSON.stringify(rebuilt));
  const recorded = topoEvent.topology_hash;

  const ok = rebuiltHash === recorded;

  // Write replay artifact
  const replayOut = {
    verdict: ok ? "PASS" : "FAIL",
    session,
    recorded_topology_hash: recorded,
    rebuilt_topology_hash: rebuiltHash,
    clp_last_hash: chain.lastHash,
    checked_event_timestamp: topoEvent.timestamp || null,
  };

  fs.writeFileSync(path.join(dir, "topology_replay_verify.json"), JSON.stringify(replayOut, null, 2));

  if (!ok) {
    console.error("FAIL: topology_hash mismatch");
    console.error(" recorded:", recorded);
    console.error(" rebuilt :", rebuiltHash);
    process.exit(2);
  }

  console.log("PASS: CLP chain OK, topology replay OK");
  process.exit(0);
}

run();
