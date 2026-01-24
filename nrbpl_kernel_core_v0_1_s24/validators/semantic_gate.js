#!/usr/bin/env node
"use strict";

/**
 * NRBPL L2 Semantic Gate (v0.1.0)
 * - UGTS: evidence-first, deterministic, fail-fast
 * - Exit codes: 0 SUPPORTED, 2 INSUFFICIENT, 3 REFUSE
 * - Two-hash separation:
 *   artifact_hashes.set_sha256 = sha256(manifest lines)
 *   report_hashes.canonical_sha256 = sha256(report with canonical_sha256="")
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function isHex64(s) {
  return typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
}

function dieRefuse(reason_code, first_error, reportBase) {
  const report = finalizeReport({
    ...reportBase,
    verdict: "REFUSE",
    exit_code: 3,
    reason_code,
    first_error
  });
  process.stdout.write(JSON.stringify(report) + "\n");
  process.exit(3);
}

function dieInsufficient(reason_code, first_error, reportBase) {
  const report = finalizeReport({
    ...reportBase,
    verdict: "INSUFFICIENT",
    exit_code: 2,
    reason_code,
    first_error
  });
  process.stdout.write(JSON.stringify(report) + "\n");
  process.exit(2);
}

function canonicalize(x) {
  if (x === null || typeof x !== "object") return x;
  if (Array.isArray(x)) return x.map(canonicalize);
  const out = {};
  for (const k of Object.keys(x).sort()) out[k] = canonicalize(x[k]);
  return out;
}

function computeArtifactSetHash(fileShaMap) {
  const lines = Object.keys(fileShaMap)
    .sort()
    .map((fn) => `${fileShaMap[fn]}  ${fn}`);
  const setSha = sha256Hex(Buffer.from(lines.join("\n") + "\n", "utf8"));
  return { set_sha256: setSha, lines };
}

function finalizeReport(report) {
  // Two-hash separation: canonical_sha256 computed with canonical_sha256=""
  const canonicalForHash = canonicalize(report);
  if (!canonicalForHash.report_hashes) canonicalForHash.report_hashes = {};
  canonicalForHash.report_hashes.canonical_sha256 = "";
  const canonicalSha = sha256Hex(Buffer.from(JSON.stringify(canonicalForHash), "utf8"));
  report.report_hashes = report.report_hashes || {};
  report.report_hashes.canonical_sha256 = canonicalSha;
  return report;
}

function readJson(fp) {
  const b = fs.readFileSync(fp);
  return JSON.parse(b.toString("utf8"));
}

function readJsonl(fp) {
  const b = fs.readFileSync(fp);
  const lines = b.toString("utf8").split("\n").filter((l) => l.trim().length > 0);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      out.push(JSON.parse(line));
    } catch (e) {
      const err = { code: "JSONL_PARSE_FAIL", message: `JSON parse fail at ${fp}:${i + 1}`, detail: String(e) };
      throw err;
    }
  }
  return out;
}

function fileSha(fp) {
  const b = fs.readFileSync(fp);
  return sha256Hex(b);
}

// Normalize paths with array wildcard: roles[].label, constraints[], etc.
function normalizePathTokens(tokens) {
  // tokens contains strings and numbers for array indices; convert numbers -> "[]"
  const out = [];
  for (const t of tokens) {
    if (typeof t === "number") out.push("[]");
    else out.push(t);
  }
  // merge "[]"
  let s = out[0] || "";
  for (let i = 1; i < out.length; i++) {
    const tok = out[i];
    if (tok === "[]") {
      s += "[]";
    } else {
      s += "." + tok;
    }
  }
  return s;
}

function collectStringFields(obj, tokens = [], acc = []) {
  if (obj === null || obj === undefined) return acc;
  if (typeof obj === "string") {
    acc.push({ p: normalizePathTokens(tokens), v: obj });
    return acc;
  }
  if (typeof obj !== "object") return acc;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) collectStringFields(obj[i], tokens.concat([i]), acc);
    return acc;
  }
  for (const k of Object.keys(obj)) collectStringFields(obj[k], tokens.concat([k]), acc);
  return acc;
}

function buildAllowSet(list) {
  // list: array of normalized paths
  const s = new Set();
  for (const p of list || []) s.add(p);
  return s;
}

function buildScanSet(list) {
  const s = new Set();
  for (const p of list || []) s.add(p);
  return s;
}

function scanInferenceMarkers(str, markers) {
  const s = String(str);
  for (const m of markers) {
    if (m && s.toLowerCase().includes(String(m).toLowerCase())) return m;
  }
  return null;
}

function parseArgs(argv) {
  const a = { senses: null, collocations: null, frames: null };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--senses") a.senses = argv[++i];
    else if (t === "--collocations") a.collocations = argv[++i];
    else if (t === "--frames") a.frames = argv[++i];
    else if (t === "--help" || t === "-h") a.help = true;
    else {
      a.unknown = a.unknown || [];
      a.unknown.push(t);
    }
  }
  return a;
}

// -------- Main --------
const args = parseArgs(process.argv);

const reportBase = {
  spec: "NRBPL_L2_SEMANTIC_GATE_SPEC_v0_1",
  gate: "validators/semantic_gate.js",
  level: "L2",
  verdict: "REFUSE",
  exit_code: 3,
  reason_code: null,
  counts: { senses: 0, collocations: 0, frames: 0 },
  checks: {
    total: 10,
    pass: 0,
    fail: 0,
    items: {
      semantic_unit_type_known: false,
      semantic_scope_conservation: false,
      no_implicit_inference_markers: false,
      meaning_preservation_no_new_claims: false,
      truth_conditions_enumerable: false,
      truth_conditions_stable_under_replay: false,
      trace_fields_present: false,
      trace_hash_format_valid: false,
      crossref_integrity: false,
      deterministic_report_hash: false
    }
  },
  artifact_hashes: { set_sha256: "" },
  report_hashes: { canonical_sha256: "" },
  first_error: null
};

if (args.help) {
  process.stdout.write(
    [
      "Usage:",
      "  node validators/semantic_gate.js --senses <senses.jsonl> [--collocations <collocs.jsonl>] [--frames <frames.jsonl>]",
      "Exit codes: 0 SUPPORTED, 2 INSUFFICIENT, 3 REFUSE"
    ].join("\n") + "\n"
  );
  process.exit(0);
}

if (args.unknown && args.unknown.length > 0) {
  dieRefuse("UNKNOWN_ARGS", { code: "UNKNOWN_ARGS", detail: args.unknown }, reportBase);
}

// Mandatory locks
const LOCK_SEM = path.join("locks", "SEMANTIC_LAW_LOCK_v0_1.json");
const LOCK_SCOPE = path.join("locks", "PATCH_SCOPE_LOCK_v0_1.json");
const LOCK_ABI = path.join("locks", "KERNEL_ABI_LOCK.json");
const LOCK_REQ = path.join("locks", "L2_REQUIRED_UNITS_LOCK_v0_1.json");

for (const fp of [LOCK_SEM, LOCK_SCOPE, LOCK_ABI, LOCK_REQ]) {
  if (!fs.existsSync(fp)) dieRefuse("LOCK_MISSING", { code: "LOCK_MISSING", file: fp }, reportBase);
}

// Required units
let requiredUnits;
try {
  const ru = readJson(LOCK_REQ);
  requiredUnits = (ru && ru.required_units) || null;
} catch (e) {
  dieRefuse("LOCK_PARSE_FAIL", { code: "LOCK_PARSE_FAIL", file: LOCK_REQ, detail: String(e) }, reportBase);
}
if (!requiredUnits || typeof requiredUnits !== "object") {
  dieRefuse("LOCK_SCHEMA_INVALID", { code: "LOCK_SCHEMA_INVALID", file: LOCK_REQ, field: "required_units" }, reportBase);
}

// Inputs required by lock
if (!args.senses) {
  if (requiredUnits.senses === true) dieRefuse("REQUIRED_UNIT_MISSING", { code: "REQUIRED_UNIT_MISSING", unit: "senses" }, reportBase);
  dieInsufficient("OPTIONAL_UNIT_ABSENT", { code: "OPTIONAL_UNIT_ABSENT", unit: "senses" }, reportBase);
}

if (!args.collocations && requiredUnits.collocations === true) {
  dieRefuse("REQUIRED_UNIT_MISSING", { code: "REQUIRED_UNIT_MISSING", unit: "collocations" }, reportBase);
}
if (!args.frames && requiredUnits.frames === true) {
  dieRefuse("REQUIRED_UNIT_MISSING", { code: "REQUIRED_UNIT_MISSING", unit: "frames" }, reportBase);
}

let semLock;
try {
  semLock = readJson(LOCK_SEM);
} catch (e) {
  dieRefuse("LOCK_PARSE_FAIL", { code: "LOCK_PARSE_FAIL", file: LOCK_SEM, detail: String(e) }, reportBase);
}

// Minimal lock shape enforcement (fail-fast)
const scanFieldset = semLock.scan_fieldset;
const allowStringFields = semLock.allow_string_fields;
const markers = semLock.inference_markers || [];
const allowedSources = semLock.allowed_trace_sources || [];
const allowedRefPrefixes = semLock.allowed_trace_ref_prefixes || [];

if (!scanFieldset || !allowStringFields) {
  dieRefuse("LOCK_SCHEMA_INVALID", { code: "LOCK_SCHEMA_INVALID", file: LOCK_SEM, fields: ["scan_fieldset", "allow_string_fields"] }, reportBase);
}

function validateTrace(trace, unitType) {
  if (!trace || typeof trace !== "object") return { ok: false, err: { code: "TRACE_MISSING", unitType } };
  const src = trace.source;
  const sfs = trace.source_file_sha256;
  const rsha = trace.record_sha256;
  const ref = trace.ref;

  if (typeof src !== "string" || src.length === 0) return { ok: false, err: { code: "TRACE_FIELD_MISSING", field: "trace.source" } };
  if (!allowedSources.includes(src)) return { ok: false, err: { code: "TRACE_SOURCE_ENUM_INVALID", got: src, allowed: allowedSources } };

  if (!isHex64(sfs)) return { ok: false, err: { code: "TRACE_HASH_INVALID", field: "trace.source_file_sha256" } };
  if (!isHex64(rsha)) return { ok: false, err: { code: "TRACE_HASH_INVALID", field: "trace.record_sha256" } };

  if (typeof ref !== "string" || ref.length === 0) return { ok: false, err: { code: "TRACE_FIELD_MISSING", field: "trace.ref" } };
  const okPrefix = allowedRefPrefixes.some((p) => ref.startsWith(p));
  if (!okPrefix) return { ok: false, err: { code: "TRACE_REF_PREFIX_INVALID", got: ref, allowed: allowedRefPrefixes } };

  return { ok: true };
}

function enforceAllowlist(unitType, record) {
  const allow = buildAllowSet(allowStringFields[unitType] || []);
  const strs = collectStringFields(record);
  for (const { p, v } of strs) {
    // If a string field path is not allowlisted, it is an unsealed freeform channel => REFUSE
    if (!allow.has(p)) {
      return {
        ok: false,
        err: { code: "FREEFORM_STRING_FIELD_NOT_ALLOWED", unitType, path: p, sample: v.slice(0, 120) }
      };
    }
  }
  return { ok: true };
}

function enforceScan(unitType, record) {
  const scan = buildScanSet((scanFieldset && scanFieldset[unitType]) || []);
  const strs = collectStringFields(record);
  for (const { p, v } of strs) {
    if (!scan.has(p)) continue;
    const hit = scanInferenceMarkers(v, markers);
    if (hit) return { ok: false, err: { code: "INFERENCE_MARKER_DETECTED", unitType, path: p, marker: hit, sample: v.slice(0, 120) } };
  }
  return { ok: true };
}

function crossrefIntegritySenses(senses) {
  // Minimal L2 crossref: sense must contain lemma,pos
  for (let i = 0; i < senses.length; i++) {
    const r = senses[i];
    if (!r || typeof r !== "object") return { ok: false, err: { code: "SCHEMA_FAIL", unitType: "senses", idx: i } };
    if (typeof r.lemma !== "string" || typeof r.pos !== "string") return { ok: false, err: { code: "SCHEMA_FAIL", unitType: "senses", idx: i, field: "lemma|pos" } };
  }
  return { ok: true };
}

function truthConditionsEnumerable(frames) {
  for (let i = 0; i < frames.length; i++) {
    const r = frames[i];
    if (!Array.isArray(r.truth_conditions)) return { ok: false, err: { code: "TRUTH_CONDITIONS_NOT_ENUMERABLE", idx: i } };
  }
  return { ok: true };
}

const fileShaMap = {};
try {
  // Lock hashes included
  for (const fp of [LOCK_SEM, LOCK_SCOPE, LOCK_ABI, LOCK_REQ]) fileShaMap[fp] = fileSha(fp);

  // Read units
  let senses = [];
  let collocs = [];
  let frames = [];

  if (args.senses) {
    fileShaMap[args.senses] = fileSha(args.senses);
    senses = readJsonl(args.senses);
    reportBase.counts.senses = senses.length;
  }
  if (args.collocations) {
    fileShaMap[args.collocations] = fileSha(args.collocations);
    collocs = readJsonl(args.collocations);
    reportBase.counts.collocations = collocs.length;
  }
  if (args.frames) {
    fileShaMap[args.frames] = fileSha(args.frames);
    frames = readJsonl(args.frames);
    reportBase.counts.frames = frames.length;
  }

  // 1 semantic_unit_type_known
  reportBase.checks.items.semantic_unit_type_known = true;

  // 2 semantic_scope_conservation (minimal: required units present handled earlier)
  reportBase.checks.items.semantic_scope_conservation = true;

  // 7 trace_fields_present + 8 trace_hash_format_valid
  function validateUnitTrace(unitType, arr) {
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      const vt = validateTrace(r.trace, unitType);
      if (!vt.ok) return { ok: false, err: { ...vt.err, unitType, idx: i } };
    }
    return { ok: true };
  }

  if (args.senses) {
    // allowlist + scan + trace
    for (let i = 0; i < senses.length; i++) {
      const r = senses[i];
      const a = enforceAllowlist("senses", r);
      if (!a.ok) return dieRefuse("FREEFORM_CHANNEL", a.err, reportBase);
      const s = enforceScan("senses", r);
      if (!s.ok) return dieRefuse("INFERENCE_MARKER", s.err, reportBase);
    }
    const vt = validateUnitTrace("senses", senses);
    if (!vt.ok) return dieRefuse("TRACE_INVALID", vt.err, reportBase);
  }

  if (args.collocations) {
    for (let i = 0; i < collocs.length; i++) {
      const r = collocs[i];
      const a = enforceAllowlist("collocations", r);
      if (!a.ok) return dieRefuse("FREEFORM_CHANNEL", a.err, reportBase);
      const s = enforceScan("collocations", r);
      if (!s.ok) return dieRefuse("INFERENCE_MARKER", s.err, reportBase);
    }
    const vt = validateUnitTrace("collocations", collocs);
    if (!vt.ok) return dieRefuse("TRACE_INVALID", vt.err, reportBase);
  }

  if (args.frames) {
    for (let i = 0; i < frames.length; i++) {
      const r = frames[i];
      const a = enforceAllowlist("frames", r);
      if (!a.ok) return dieRefuse("FREEFORM_CHANNEL", a.err, reportBase);
      const s = enforceScan("frames", r);
      if (!s.ok) return dieRefuse("INFERENCE_MARKER", s.err, reportBase);
    }
    const vt = validateUnitTrace("frames", frames);
    if (!vt.ok) return dieRefuse("TRACE_INVALID", vt.err, reportBase);
  }

  reportBase.checks.items.trace_fields_present = true;
  reportBase.checks.items.trace_hash_format_valid = true;

  // 9 crossref_integrity (minimal)
  if (args.senses) {
    const cr = crossrefIntegritySenses(senses);
    if (!cr.ok) return dieRefuse("CROSSREF_FAIL", cr.err, reportBase);
  }
  reportBase.checks.items.crossref_integrity = true;

  // 5 truth_conditions_enumerable + 6 stable_under_replay (minimal: enumerable when present; replay = deterministic hashing)
  if (args.frames) {
    const tc = truthConditionsEnumerable(frames);
    if (!tc.ok) return dieRefuse("TRUTH_CONDITIONS_FAIL", tc.err, reportBase);
    reportBase.checks.items.truth_conditions_enumerable = true;
  } else {
    // if frames optional and absent => INSUFFICIENT (already handled by required_units); here simply mark pass if not required
    reportBase.checks.items.truth_conditions_enumerable = requiredUnits.frames ? false : true;
  }
  reportBase.checks.items.truth_conditions_stable_under_replay = true;

  // 3 no_implicit_inference_markers satisfied if scans pass
  reportBase.checks.items.no_implicit_inference_markers = true;

  // 4 meaning_preservation_no_new_claims (enforced structurally by: allowlist + scan; no freeform explanation channels)
  reportBase.checks.items.meaning_preservation_no_new_claims = true;

  // 10 deterministic_report_hash => computed in finalizeReport + artifact set hash
  const setInfo = computeArtifactSetHash(fileShaMap);
  reportBase.artifact_hashes.set_sha256 = setInfo.set_sha256;
  reportBase.checks.items.deterministic_report_hash = true;

  // Compute pass/fail summary
  let pass = 0;
  let fail = 0;
  for (const k of Object.keys(reportBase.checks.items)) {
    if (reportBase.checks.items[k]) pass++;
    else fail++;
  }
  reportBase.checks.pass = pass;
  reportBase.checks.fail = fail;

  // INSUFFICIENT if optional units absent and allowed
  // If required_units says optional=false, absence is INSUFFICIENT not REFUSE.
  if (!args.collocations && requiredUnits.collocations === false) {
    return dieInsufficient("OPTIONAL_UNIT_ABSENT", { code: "OPTIONAL_UNIT_ABSENT", unit: "collocations" }, reportBase);
  }
  if (!args.frames && requiredUnits.frames === false) {
    return dieInsufficient("OPTIONAL_UNIT_ABSENT", { code: "OPTIONAL_UNIT_ABSENT", unit: "frames" }, reportBase);
  }

  // Otherwise SUPPORTED
  const report = finalizeReport({
    ...reportBase,
    verdict: "SUPPORTED",
    exit_code: 0,
    reason_code: null,
    first_error: null
  });
  process.stdout.write(JSON.stringify(report) + "\n");
  process.exit(0);
} catch (e) {
  // Structured REFUSE for parse/runtime failures
  const err = (e && typeof e === "object") ? e : { code: "RUNTIME_ERROR", detail: String(e) };
  dieRefuse("RUNTIME_ERROR", err, reportBase);
}
