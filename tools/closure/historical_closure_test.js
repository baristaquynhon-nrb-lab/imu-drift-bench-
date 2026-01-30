#!/usr/bin/env node
// tools/closure/historical_closure_test.js
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { stableStringify } = require("./stable_stringify");

function sha256(x) { return crypto.createHash("sha256").update(x).digest("hex"); }

function fail(msg, extra) {
  console.error("FAIL:", msg);
  if (extra) console.error(extra);
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
  const lines = readLines(p);
  return lines.map((line, idx) => {
    try { return JSON.parse(line); }
    catch (e) { throw new Error(`LEDGER_PARSE_ERROR line=${idx + 1}`); }
  });
}

function verifyCLPChain(events, headOrNull) {
  let lastHash = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const { prevHash, hash, ...decision } = e || {};
    if (!prevHash || !hash) return { ok: false, reason: "MISSING_prevHash_or_hash", i };

    const recomputed = sha256(stableStringify(decision) + prevHash);
    if (recomputed !== hash) return { ok: false, reason: "HASH_MISMATCH", i, expected: recomputed, got: hash };

    if (i > 0 && prevHash !== lastHash) return { ok: false, reason: "CHAIN_BREAK", i, prevHash, lastHash };
    lastHash = hash;
  }

  if (headOrNull && lastHash && headOrNull !== lastHash) {
    return { ok: false, reason: "HEAD_MISMATCH", expected: lastHash, got: headOrNull };
  }
  return { ok: true, lastHash };
}

/**
 * Optional: state snapshot check
 * If state_snapshot.json exists, it must match reconstructed_state_hash in the latest event.
 * This enforces "no current state without ledger lineage".
 */
function run() {
  const dir = process.argv[2];
  if (!dir) refuse("Usage: node tools/closure/historical_closure_test.js <session_dir>");

  const ledgerPath = path.join(dir, "clp_ledger_append.jsonl");
  const headPath   = path.join(dir, "clp_hash_head.txt");

  if (!fs.existsSync(ledgerPath)) refuse(`missing ${ledgerPath}`);

  const head = fs.existsSync(headPath) ? fs.readFileSync(headPath, "utf8").trim() : null;

  const events = parseJSONL(ledgerPath);
  if (events.length === 0) fail("ledger empty");

  const chain = verifyCLPChain(events, head);
  if (!chain.ok) fail("CLP chain invalid", chain);

  // Minimal closure requirement: latest event exists + chain OK.
  const latest = events[events.length - 1];

  // Optional snapshot closure
  const snapPath = path.join(dir, "state_snapshot.json");
  if (fs.existsSync(snapPath)) {
    const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
    const snapHash = sha256(stableStringify(snap));

    // We require the latest event to carry a state hash field if snapshot enforcement is used.
    const evStateHash = latest && (latest.state_hash || latest.meaning_state_hash || null);
    if (!evStateHash) fail("snapshot present but event missing state_hash/meaning_state_hash");

    if (snapHash !== evStateHash) {
      fail("snapshot hash mismatch (state without correct ledger lineage)", { expected: evStateHash, got: snapHash });
    }
  }

  console.log("PASS: Historical Consistency / CLP Closure (HCC) chain OK.", "HEAD:", chain.lastHash);
  process.exit(0);
}

run();
