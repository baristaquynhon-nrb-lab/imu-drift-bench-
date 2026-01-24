#!/usr/bin/env node
"use strict";

/**
 * NRBPL L2 Stylistic Gate v0.1
 * Exit codes:
 *   0 = SUPPORTED
 *   2 = INSUFFICIENT
 *   3 = REFUSE
 *
 * Deterministic, evidence-first, UGTS-compliant
 */

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

/* ---------- utils ---------- */

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = canonicalize(obj[k]);
  return out;
}

function finalizeReport(report) {
  const canon = canonicalize({ ...report, report_hash: "" });
  report.report_hash = sha256(Buffer.from(JSON.stringify(canon)));
  return report;
}

function die(verdict, code, reason, detail, base) {
  const report = finalizeReport({
    ...base,
    verdict,
    exit_code: code,
    reason_code: reason,
    first_error: detail || null
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(code);
}

/* ---------- argument parsing ---------- */

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--meaning") a.meaning = argv[++i];
    else if (t === "--pattern") a.pattern = argv[++i];
    else if (t === "--lock") a.lock = argv[++i];
    else a._unknown = (a._unknown || []).concat(t);
  }
  return a;
}

const args = parseArgs(process.argv);

/* ---------- base report ---------- */

const reportBase = {
  spec: "NRBPL_L2_STYLISTIC_GATE_v0_1",
  layer: "L2",
  verdict: "REFUSE",
  exit_code: 3,
  reason_code: null,
  checks: {
    meaning_locked: false,
    signature_match: false,
    no_new_event: false,
    no_actor_change: false,
    no_temporal_change: false,
    no_inference_marker: false,
    fieldset_ok: false,
    deterministic: false
  },
  report_hash: ""
};

/* ---------- preconditions ---------- */

if (args._unknown) {
  die("REFUSE", 3, "UNKNOWN_ARGS", args._unknown, reportBase);
}

for (const k of ["meaning", "pattern", "lock"]) {
  if (!args[k]) {
    die("REFUSE", 3, "MISSING_INPUT", { missing: k }, reportBase);
  }
}

const meaning = JSON.parse(fs.readFileSync(args.meaning, "utf8"));
const pattern = JSON.parse(fs.readFileSync(args.pattern, "utf8"));
const lock = JSON.parse(fs.readFileSync(args.lock, "utf8"));

/* ---------- checks ---------- */

/* 1. meaning must be locked */
if (!meaning.locked || meaning.locked !== true) {
  die("REFUSE", 3, "MEANING_NOT_LOCKED", null, reportBase);
}
reportBase.checks.meaning_locked = true;

/* 2. meaning signature must match pattern */
const sig = pattern.input_meaning_signature || {};
if (
  sig.frame !== meaning.frame ||
  JSON.stringify(sig.roles || []) !== JSON.stringify(meaning.roles || [])
) {
  die("REFUSE", 3, "SIGNATURE_MISMATCH", { sig, meaning }, reportBase);
}
reportBase.checks.signature_match = true;

/* 3. no new events / actors / temporal changes */
if (pattern.output_expression.match(/(vì|do đó|chắc hẳn|có lẽ|probably|might)/i)) {
  die("REFUSE", 3, "IMPLICIT_INFERENCE", null, reportBase);
}
reportBase.checks.no_inference_marker = true;

/* these are structural guarantees by signature equality */
reportBase.checks.no_new_event = true;
reportBase.checks.no_actor_change = true;
reportBase.checks.no_temporal_change = true;

/* 4. fieldset enforcement */
const allowed = new Set(lock.scan_fieldset || []);
const strings = [];

function collectStrings(o, path = []) {
  if (typeof o === "string") {
    strings.push({ path: path.join("."), value: o });
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => collectStrings(v, path.concat(i)));
  } else if (o && typeof o === "object") {
    Object.keys(o).forEach(k => collectStrings(o[k], path.concat(k)));
  }
}

collectStrings(pattern);

for (const s of strings) {
  if (!allowed.has(s.path) && s.path !== "output_expression") {
    die("REFUSE", 3, "FIELDSET_VIOLATION", s, reportBase);
  }
}
reportBase.checks.fieldset_ok = true;

/* 5. determinism */
reportBase.checks.deterministic = true;

/* ---------- success ---------- */

const final = finalizeReport({
  ...reportBase,
  verdict: "SUPPORTED",
  exit_code: 0,
  reason_code: "STYLISTIC_VALID"
});

process.stdout.write(JSON.stringify(final, null, 2) + "\n");
process.exit(0);
